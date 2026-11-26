import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { PRESETS } from "../lib/shared/presets";
import { MEMBER, OWNER, ORIGIN, apiCall, call, fresh, mockMeta, say, sessionFor } from "./helpers";

beforeEach(fresh);

describe("WhatsApp sign-in", () => {
  async function start() {
    const res = await apiCall("POST", "/login/start");
    const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
    return { body: (await res.json()) as { code: string; link: string }, cookie, raw: res.headers.get("set-cookie")! };
  }
  const poll = (cookie: string) =>
    call(new Request(`${ORIGIN}/api/login/poll`, { method: "POST", headers: { cookie, "x-church": "1" } }));

  it("signs in the owner after they send LOGIN <code>, with no reply", async () => {
    const box = mockMeta();
    const { body, cookie, raw } = await start();
    expect(body.code).toMatch(/^\d{6}$/);
    expect(body.link).toBe(`https://wa.me/919000000000?text=LOGIN%20${body.code}`);
    expect(raw).toContain("HttpOnly");

    expect(await (await poll(cookie)).json()).toEqual({ status: "pending" });
    await say(`LOGIN ${body.code}`, OWNER);
    expect(box.replies).toHaveLength(0);

    const res = await poll(cookie);
    expect(await res.json()).toEqual({ status: "approved" });
    const sid = res.headers.getSetCookie().find((c) => c.startsWith("sid="))!;
    expect(sid).toMatch(/HttpOnly/);
    expect(sid).toMatch(/Secure/);
    expect(sid).toMatch(/SameSite=Strict/);

    const me = await apiCall("GET", "/me", { cookie: sid.split(";")[0] });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { role: string }).role).toBe("admin");

    // Single use: the same pending cookie can't mint a second session.
    expect(await (await poll(cookie)).json()).toEqual({ status: "expired" });
  });

  it("ignores LOGIN from someone who isn't an admin (they just get the menu)", async () => {
    const box = mockMeta();
    const { body, cookie } = await start();
    await say(`LOGIN ${body.code}`, MEMBER);
    expect(box.replies).toHaveLength(1);
    expect(box.replies[0]!.interactive.type).toBe("list");
    expect(await (await poll(cookie)).json()).toEqual({ status: "pending" });
  });

  it("won't approve an expired code", async () => {
    mockMeta();
    const { body, cookie } = await start();
    await env.DB.prepare("UPDATE login_requests SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    await say(`LOGIN ${body.code}`, OWNER);
    expect(await (await poll(cookie)).json()).toEqual({ status: "expired" });
  });

  it("signs in as the owner with the setup key, and only with the right one", async () => {
    const wrong = await apiCall("POST", "/login/key", { body: { key: "nope" } });
    expect(wrong.status).toBe(403);
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const right = await apiCall("POST", "/login/key", { body: { key: "test-setup-key" } });
    expect(right.status).toBe(200);
    const sid = right.headers.get("set-cookie")!;
    expect(sid).toMatch(/^sid=.+HttpOnly; Secure; SameSite=Strict/);
    const me = (await (await apiCall("GET", "/me", { cookie: sid.split(";")[0] })).json()) as { phone: string; role: string };
    expect(me).toMatchObject({ phone: OWNER, role: "admin" });
  });

  it("refuses the setup key when SETUP_KEY isn't set", async () => {
    const res = await call(
      new Request(`${ORIGIN}/api/login/key`, {
        method: "POST",
        headers: { "x-church": "1", "content-type": "application/json" },
        body: JSON.stringify({ key: "" }),
      }),
      { ...env, SETUP_KEY: "" },
    );
    expect(res.status).toBe(400);
    const off = await call(
      new Request(`${ORIGIN}/api/login/key`, {
        method: "POST",
        headers: { "x-church": "1", "content-type": "application/json" },
        body: JSON.stringify({ key: "anything" }),
      }),
      { ...env, SETUP_KEY: "" },
    );
    expect(off.status).toBe(403);
    expect(((await off.json()) as { error: string }).error).toContain("turned off");
  });

  it("'logout all' from the admin's phone ends every session", async () => {
    mockMeta();
    const cookie = await sessionFor(OWNER);
    await say("logout all", OWNER);
    expect((await apiCall("GET", "/me", { cookie })).status).toBe(401);
  });
});

describe("API guards", () => {
  it("needs a session", async () => {
    expect((await apiCall("GET", "/blocks")).status).toBe(401);
  });

  it("refuses writes without the x-church header (CSRF)", async () => {
    const cookie = await sessionFor(OWNER);
    const res = await apiCall("POST", "/blocks", { cookie, body: PRESETS[0]!.block, csrf: false });
    expect(res.status).toBe(403);
  });

  it("keeps editors out of admin pages and private requests", async () => {
    mockMeta();
    await say("pray");
    await say("private request");
    await say("New here?"); // not a menu item: just the menu
    const editor = await sessionFor("919833333333", "editor");
    expect((await apiCall("GET", "/admins", { cookie: editor })).status).toBe(403);
    expect(await (await apiCall("GET", "/submissions", { cookie: editor })).json()).toEqual([]);

    const admin = await sessionFor(OWNER);
    const all = (await (await apiCall("GET", "/submissions", { cookie: admin })).json()) as unknown[];
    expect(all).toHaveLength(1);
  });

  it("rejects text longer than WhatsApp allows", async () => {
    const cookie = await sessionFor(OWNER);
    const block = { ...PRESETS[0]!.block, title: "A title far longer than twenty-four" };
    const res = await apiCall("POST", "/blocks", { cookie, body: block });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/title/);
  });

  it("holds the menu to 10 items", async () => {
    const cookie = await sessionFor(OWNER);
    await apiCall("GET", "/blocks", { cookie }); // seeds the six starters
    for (let i = 0; i < 4; i++) {
      expect((await apiCall("POST", "/blocks", { cookie, body: PRESETS[6 + i]!.block })).status).toBe(201);
    }
    const res = await apiCall("POST", "/blocks", { cookie, body: PRESETS[10]!.block });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("10 items");
  });

  it("won't let an admin remove the owner or themselves", async () => {
    const cookie = await sessionFor("919844444444");
    await apiCall("GET", "/me", { cookie }); // seeds the owner
    expect((await apiCall("DELETE", `/admins/${OWNER}`, { cookie })).status).toBe(400);
    expect((await apiCall("DELETE", "/admins/919844444444", { cookie })).status).toBe(400);
  });
});

describe("usage meter", () => {
  it("counts each reply and prices those past the free allowance", async () => {
    mockMeta();
    const cookie = await sessionFor(OWNER);
    await apiCall("PUT", "/settings", { cookie, body: { free_per_month: "2", rate_per_message: "0.5" } });
    for (const t of ["hi", "1", "2", "4"]) await say(t);
    const { usage } = (await (await apiCall("GET", "/overview", { cookie })).json()) as {
      usage: { sent: number; paid: number; cost: number };
    };
    expect(usage).toMatchObject({ sent: 4, paid: 2, cost: 1 });
  });
});

describe("media", () => {
  it("stores an uploaded JPEG and serves it publicly", async () => {
    const cookie = await sessionFor(OWNER);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const res = await call(
      new Request(`${ORIGIN}/api/media`, { method: "POST", headers: { cookie, "x-church": "1", "content-type": "image/jpeg" }, body: bytes }),
    );
    expect(res.status).toBe(201);
    const { url } = (await res.json()) as { url: string };
    const img = await call(new Request(`${ORIGIN}${url}`));
    expect(img.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await img.arrayBuffer())).toEqual(bytes);
  });

  it("refuses anything but JPEG or PNG", async () => {
    const cookie = await sessionFor(OWNER);
    const res = await call(
      new Request(`${ORIGIN}/api/media`, { method: "POST", headers: { cookie, "x-church": "1", "content-type": "image/svg+xml" }, body: "<svg/>" }),
    );
    expect(res.status).toBe(415);
  });
});
