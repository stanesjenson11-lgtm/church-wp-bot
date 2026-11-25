import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { MEMBER, addEvent, bodyOf, dayFromNow, fresh, idsOf, mockMeta, say, tap } from "./helpers";

beforeEach(fresh);

const OTHER = "919822222222";

describe("event list", () => {
  it("lists upcoming events only, soonest first, in India time", async () => {
    const box = mockMeta();
    await addEvent({ id: "past", title: "Last week", date: dayFromNow(-1) });
    await addEvent({ id: "later", title: "Later", date: dayFromNow(20) });
    await addEvent({ id: "today", title: "Today", date: dayFromNow(0) });
    await say("events");
    expect(idsOf(box.replies[0]!)).toEqual(["e:today", "e:later"]);
  });

  it("goes straight to the card when there is one event", async () => {
    const box = mockMeta();
    await addEvent({ id: "only", title: "Youth Retreat" });
    await say("events");
    expect(bodyOf(box.replies[0]!)).toContain("*Youth Retreat*");
    expect(idsOf(box.replies[0]!)).toEqual(["r:only", "menu"]);
  });

  it("says so when nothing is coming up", async () => {
    const box = mockMeta();
    await say("events");
    expect(bodyOf(box.replies[0]!)).toContain("No upcoming events");
  });
});

describe("registration", () => {
  it("registers with a headcount, then shows Cancel instead of Register", async () => {
    const box = mockMeta();
    await addEvent({ id: "carols" });
    await tap("r:carols", MEMBER, "button");
    expect(bodyOf(box.replies[0]!)).toContain("How many people");
    await tap("a:3");
    expect(bodyOf(box.replies[1]!)).toContain("You're registered for *Carol Service*");
    expect(bodyOf(box.replies[1]!)).toContain("3 people");

    const row = await env.DB.prepare("SELECT headcount, status, name FROM registrations").first<{ headcount: number; status: string; name: string }>();
    expect(row).toEqual({ headcount: 3, status: "confirmed", name: "Test Member" });

    await tap("e:carols");
    expect(idsOf(box.replies[2]!)).toEqual(["x:carols", "menu"]);
    expect(box.replies).toHaveLength(3);
  });

  it("asks the event's own questions after the headcount", async () => {
    const box = mockMeta();
    await addEvent({
      id: "lunch",
      questions: JSON.stringify([{ id: "food", label: "Veg or non-veg?", kind: "choice", options: ["Veg", "Non-veg"], optional: false }]),
    });
    await tap("r:lunch", MEMBER, "button");
    await say("2");
    expect(bodyOf(box.replies[1]!)).toContain("Veg or non-veg?");
    await tap("a:1", MEMBER, "button");
    const row = await env.DB.prepare("SELECT answers FROM registrations").first<{ answers: string }>();
    expect(JSON.parse(row!.answers)).toEqual({ food: "Non-veg" });
  });

  it("updates instead of duplicating when registering again", async () => {
    mockMeta();
    await addEvent({ id: "carols" });
    await tap("r:carols", MEMBER, "button");
    await tap("a:2");
    await tap("x:carols", MEMBER, "button");
    await tap("r:carols", MEMBER, "button");
    await tap("a:4");
    const rows = await env.DB.prepare("SELECT headcount, status FROM registrations").all();
    expect(rows.results).toEqual([{ headcount: 4, status: "confirmed" }]);
  });

  it("cancels, and 'my events' lists only confirmed upcoming ones", async () => {
    const box = mockMeta();
    await addEvent({ id: "a", title: "Alpha", date: dayFromNow(3), ask_headcount: 0 });
    await addEvent({ id: "b", title: "Beta", date: dayFromNow(5), ask_headcount: 0 });
    await tap("r:a", MEMBER, "button");
    await tap("r:b", MEMBER, "button");
    await tap("x:a", MEMBER, "button");
    expect(bodyOf(box.replies[2]!)).toContain("Your registration for *Alpha* is cancelled");
    await say("my events");
    expect(idsOf(box.replies[3]!)).toEqual(["e:b"]);
  });

  it("refuses when the headcount would go over capacity", async () => {
    const box = mockMeta();
    await addEvent({ id: "small", capacity: 5 });
    await tap("r:small", OTHER, "button");
    await tap("a:4", OTHER);
    await tap("r:small", MEMBER, "button");
    await tap("a:2");
    expect(bodyOf(box.replies.at(-1)!)).toContain("this event is full");
    await tap("r:small", MEMBER, "button");
    await tap("a:1");
    expect(bodyOf(box.replies.at(-1)!)).toContain("You're registered");
    const total = await env.DB.prepare("SELECT SUM(headcount) AS n FROM registrations WHERE status = 'confirmed'").first<{ n: number }>();
    expect(total?.n).toBe(5);
  });

  it("lets only one of two members racing for the last seat in", async () => {
    mockMeta();
    await addEvent({ id: "last", capacity: 1, ask_headcount: 0 });
    await Promise.all([tap("r:last", MEMBER, "button"), tap("r:last", OTHER, "button")]);
    const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM registrations WHERE status = 'confirmed'").first<{ n: number }>();
    expect(total?.n).toBe(1);
  });

  it("is closed after the deadline and when sign-up is off", async () => {
    const box = mockMeta();
    await addEvent({ id: "late", date: dayFromNow(5), signup_closes: dayFromNow(-1) });
    await addEvent({ id: "info", date: dayFromNow(6), signup_open: 0 });
    await tap("e:late");
    expect(bodyOf(box.replies[0]!)).toContain("Registration for this event is closed");
    expect(idsOf(box.replies[0]!)).toEqual(["menu"]);
    await tap("r:late", MEMBER, "button");
    expect(bodyOf(box.replies[1]!)).toContain("closed");
    await tap("e:info");
    expect(idsOf(box.replies[2]!)).toEqual(["menu"]);
    expect(bodyOf(box.replies[2]!)).not.toContain("closed");
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM registrations").first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
});
