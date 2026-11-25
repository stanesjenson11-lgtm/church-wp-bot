import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRESETS } from "../lib/shared/presets";
import {
  MEMBER,
  blockId,
  bodyOf,
  call,
  fresh,
  idsOf,
  mockMeta,
  ORIGIN,
  photo,
  postWebhook,
  say,
  sessionFor,
  apiCall,
  tap,
  webhookBody,
} from "./helpers";

beforeEach(fresh);

describe("webhook", () => {
  it("answers Meta's verification only with the right token", async () => {
    const ok = await call(new Request(`${ORIGIN}/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=42`));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("42");
    const bad = await call(new Request(`${ORIGIN}/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`));
    expect(bad.status).toBe(403);
  });

  it("rejects a bad signature and sends nothing", async () => {
    const box = mockMeta();
    const res = await postWebhook(webhookBody(MEMBER, { type: "text", text: { body: "hi" } }), env, "sha256=deadbeef");
    expect(res.status).toBe(401);
    expect(box.calls).toBe(0);
  });

  it("replies once to a message Meta delivers twice", async () => {
    const box = mockMeta();
    const body = webhookBody(MEMBER, { type: "text", text: { body: "hi" } });
    await postWebhook(body);
    await postWebhook(body);
    expect(box.replies).toHaveLength(1);
  });

  it("marks every message read, without counting it as a reply", async () => {
    const box = mockMeta();
    await say("hi");
    expect(box.reads).toHaveLength(1);
    expect(box.reads[0]!.typing_indicator).toEqual({ type: "text" });
    const usage = await env.DB.prepare("SELECT SUM(sent) AS n FROM usage").first<{ n: number }>();
    expect(usage?.n).toBe(1);
  });
});

describe("menu", () => {
  it("shows the six starter options for hi", async () => {
    const box = mockMeta();
    await say("Hi");
    const [menu] = box.replies;
    expect(menu!.interactive.type).toBe("list");
    expect(menu!.interactive.action.sections[0].rows.map((r: any) => r.title)).toEqual([
      "Service Timings",
      "Upcoming Events",
      "Prayer Request",
      "Give / Offering",
      "Church Location",
      "Contact Office",
    ]);
  });

  it("opens an option by number, by keyword and by tap, one message each", async () => {
    const box = mockMeta();
    await say("hi");
    await say("1");
    expect(bodyOf(box.replies[1]!)).toContain("Sunday Worship");
    await say("location");
    expect(box.replies[2]!.type).toBe("location");
    await tap(`b:${await blockId("Contact Office")}`);
    expect(bodyOf(box.replies[3]!)).toContain("Church Office");
    expect(idsOf(box.replies[3]!)).toEqual(["menu"]);
    expect(box.replies).toHaveLength(4);
  });

  it("answers a photo with ONE message: the sorry line on the menu", async () => {
    const box = mockMeta();
    await photo();
    expect(box.replies).toHaveLength(1);
    expect(box.replies[0]!.interactive.type).toBe("list");
    expect(bodyOf(box.replies[0]!)).toMatch(/^Sorry, I can only read text/);
  });

  it("sends the giving QR as the header of the same message", async () => {
    const box = mockMeta();
    const id = await blockId("Give / Offering");
    const row = await env.DB.prepare("SELECT data FROM blocks WHERE id = ?").bind(id).first<{ data: string }>();
    const data = { ...JSON.parse(row!.data), imageId: "11111111-1111-1111-1111-111111111111" };
    await env.DB.prepare("UPDATE blocks SET data = ? WHERE id = ?").bind(JSON.stringify(data), id).run();
    await say("give");
    expect(box.replies).toHaveLength(1);
    expect(box.replies[0]!.interactive.header).toEqual({
      type: "image",
      image: { link: `${ORIGIN}/media/11111111-1111-1111-1111-111111111111` },
    });
  });

  it("every gallery template answers a tap with exactly one message", async () => {
    const cookie = await sessionFor("919000000009");
    await env.DB.prepare("UPDATE blocks SET enabled = 0").run();
    for (const p of PRESETS) {
      const res = await apiCall("POST", "/blocks", { cookie, body: { ...p.block, enabled: true } });
      expect(res.status, p.key).toBe(201);
      const block = (await res.json()) as { id: string };
      const box = mockMeta();
      await tap(`b:${block.id}`);
      expect(box.replies, p.key).toHaveLength(1);
      await say("menu"); // leave any form it started
      await env.DB.prepare("UPDATE blocks SET enabled = 0 WHERE id = ?").bind(block.id).run();
      vi.restoreAllMocks();
    }
  });
});

describe("forms", () => {
  it("takes a prayer request privately and never logs it", async () => {
    const box = mockMeta();
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "error"), vi.spyOn(console, "warn")];
    await say("pray");
    expect(bodyOf(box.replies[0]!)).toContain("Please type your prayer request");
    await say("Please pray for my mother's surgery");
    expect(bodyOf(box.replies[1]!)).toContain("praying for you");
    expect(box.replies).toHaveLength(2);

    const row = await env.DB.prepare("SELECT * FROM submissions").first<{ data: string; private: number; wa_id: string }>();
    expect(row?.private).toBe(1);
    expect(row?.wa_id).toBe(MEMBER);
    expect(JSON.parse(row!.data)[0].value).toBe("Please pray for my mother's surgery");
    const logged = logs.flatMap((s) => s.mock.calls).flat().map(String).join(" ");
    expect(logged).not.toContain("surgery");
    expect(logged).not.toContain(MEMBER);
  });

  it("stops on cancel without saving", async () => {
    const box = mockMeta();
    await say("3");
    await say("cancel");
    expect(bodyOf(box.replies[1]!)).toContain("Cancelled");
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions").first<{ n: number }>();
    expect(n?.n).toBe(0);
    await say("hello");
    expect(box.replies[2]!.interactive.type).toBe("list");
  });

  it("walks a multi-question form with validation and skip", async () => {
    const cookie = await sessionFor("919000000009");
    const membership = PRESETS.find((p) => p.key === "membership")!.block;
    await env.DB.prepare("UPDATE blocks SET enabled = 0 WHERE title = 'Contact Office'").run();
    const res = await apiCall("POST", "/blocks", { cookie, body: membership });
    const { id } = (await res.json()) as { id: string };

    const box = mockMeta();
    await tap(`b:${id}`);
    expect(bodyOf(box.replies[0]!)).toContain("(1/6) What's your full name?");
    await say("Mary Thomas");
    await say("31-02-1990"); // not a real date
    expect(bodyOf(box.replies[2]!)).toContain("Please reply with a date");
    await say("14-02-1990");
    await say("12 Church Street");
    await tap("a:yes", MEMBER, "button");
    await say("four"); // not a number
    expect(bodyOf(box.replies[6]!)).toContain("Please reply with a number");
    await say("4");
    await say("skip");
    expect(bodyOf(box.replies.at(-1)!)).toContain("Our pastor will contact you");

    const row = await env.DB.prepare("SELECT data, private FROM submissions").first<{ data: string; private: number }>();
    expect(row?.private).toBe(0);
    expect(JSON.parse(row!.data).map((a: any) => a.value)).toEqual(["Mary Thomas", "14-02-1990", "12 Church Street", "Yes", "4", ""]);
    // One reply per message received, and nothing more.
    expect(box.replies).toHaveLength(9);
  });

  it("asks for text when a photo arrives mid-form", async () => {
    const box = mockMeta();
    await say("prayer");
    await photo();
    expect(bodyOf(box.replies[1]!)).toContain("Please type your answer as text");
  });
});

describe("delete my data", () => {
  it("removes the member's contact, requests and registrations", async () => {
    mockMeta();
    await say("pray");
    await say("a request");
    await say("delete my data");
    for (const table of ["contacts", "submissions", "registrations", "chat_state"]) {
      const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE wa_id = ?`).bind(MEMBER).first<{ n: number }>();
      expect(r?.n, table).toBe(0);
    }
  });
});

describe("dry run", () => {
  it("never calls Meta but still counts the reply", async () => {
    const box = mockMeta();
    vi.spyOn(console, "log").mockImplementation(() => {});
    await say("hi", MEMBER, { ...env, DRY_RUN: "true" });
    expect(box.calls).toBe(0);
    const usage = await env.DB.prepare("SELECT SUM(sent) AS n FROM usage").first<{ n: number }>();
    expect(usage?.n).toBe(1);
  });
});
