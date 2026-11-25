import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { vi } from "vitest";

import worker from "../worker/index";
import { ensureSeeded, resetSeedMemo, sha256 } from "../worker/store";

export const ORIGIN = "https://church-bot.test";
export const MEMBER = "919811111111";
export const OWNER = "919000000001";

/** Every payload the Worker POSTed to Meta, split into replies and read receipts. */
export type Outbox = { replies: Record<string, any>[]; reads: Record<string, any>[]; calls: number };

/** Stubs fetch so nothing leaves the test; Meta always answers 200. */
export function mockMeta(): Outbox {
  const box: Outbox = { replies: [], reads: [], calls: 0 };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    box.calls++;
    const body = JSON.parse(String(init?.body ?? "{}"));
    (body.status === "read" ? box.reads : box.replies).push(body);
    return new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] }), { status: 200 });
  });
  return box;
}

const TABLES = ["registrations", "events", "submissions", "blocks", "settings", "contacts", "chat_state", "seen", "usage", "taps", "media", "sessions", "login_requests", "admins"];

/** An empty database and no mocks, before every test. */
export async function fresh() {
  vi.restoreAllMocks();
  await env.DB.batch(TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  resetSeedMemo();
}

async function hmac(raw: string, secret = env.APP_SECRET) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  return `sha256=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function call(req: Request, e: Env = env) {
  const ctx = createExecutionContext();
  // A test Request has no incoming `cf` data; the Worker never reads it.
  const res = await worker.fetch(req as Parameters<typeof worker.fetch>[0], e, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

let seq = 0;
type Msg = Record<string, unknown>;

export function webhookBody(from: string, message: Msg, name = "Test Member") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ wa_id: from, profile: { name } }],
              messages: [{ id: `wamid.in.${++seq}`, from, timestamp: "0", ...message }],
            },
          },
        ],
      },
    ],
  };
}

export async function postWebhook(body: unknown, e: Env = env, signature?: string) {
  const raw = JSON.stringify(body);
  return call(
    new Request(`${ORIGIN}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature ?? (await hmac(raw)) },
      body: raw,
    }),
    e,
  );
}

export const say = (text: string, from = MEMBER, e?: Env) => postWebhook(webhookBody(from, { type: "text", text: { body: text } }), e);
/** A tap on a list row (default) or a reply button. The bot treats both alike. */
export const tap = (id: string, from = MEMBER, kind: "list" | "button" = "list") =>
  postWebhook(
    webhookBody(
      from,
      kind === "list"
        ? { type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: "x" } } }
        : { type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: "x" } } },
    ),
  );
export const photo = (from = MEMBER) => postWebhook(webhookBody(from, { type: "image", image: { id: "media1", mime_type: "image/jpeg" } }));

/** The last reply's visible text, whatever its type. */
export function bodyOf(reply: Record<string, any>): string {
  return reply.text?.body ?? reply.interactive?.body?.text ?? "";
}

/** The ids of the rows of a list reply, or of the buttons of a button reply. */
export function idsOf(reply: Record<string, any>): string[] {
  const a = reply.interactive?.action;
  if (a?.sections) return a.sections.flatMap((s: any) => s.rows.map((r: any) => r.id));
  if (a?.buttons) return a.buttons.map((b: any) => b.reply.id);
  return [];
}

export async function blockId(title: string): Promise<string> {
  await ensureSeeded(env);
  const r = await env.DB.prepare("SELECT id FROM blocks WHERE title = ?").bind(title).first<{ id: string }>();
  if (!r) throw new Error(`no block ${title}`);
  return r.id;
}

/** A signed-in dashboard session for `phone` (creates the admin if needed). */
export async function sessionFor(phone: string, role: "admin" | "editor" = "admin"): Promise<string> {
  const sid = `test-session-${phone}-${role}`;
  await env.DB.batch([
    env.DB.prepare("INSERT OR REPLACE INTO admins (phone, name, role, created_at) VALUES (?, ?, ?, ?)").bind(phone, `Admin ${phone}`, role, new Date().toISOString()),
    env.DB.prepare("INSERT OR REPLACE INTO sessions (id_hash, phone, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(
      await sha256(sid),
      phone,
      new Date().toISOString(),
      new Date(Date.now() + 86_400_000).toISOString(),
    ),
  ]);
  return `sid=${sid}`;
}

export function apiCall(method: string, path: string, opts: { cookie?: string; body?: unknown; csrf?: boolean } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.csrf !== false && method !== "GET") headers["x-church"] = "1";
  return call(
    new Request(`${ORIGIN}/api${path}`, {
      method,
      headers,
      body: opts.body === undefined ? (method === "GET" ? undefined : "{}") : JSON.stringify(opts.body),
    }),
  );
}

export async function addEvent(fields: Partial<{ id: string; title: string; date: string; capacity: number | null; signup_open: number; signup_closes: string | null; ask_headcount: number; questions: string }>) {
  const id = fields.id ?? crypto.randomUUID().slice(0, 8);
  await env.DB.prepare(
    "INSERT INTO events (id, title, date, time, venue, details, capacity, signup_open, signup_closes, ask_headcount, questions, created_at) VALUES (?, ?, ?, '6:00 PM', 'Main Hall', '', ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      fields.title ?? "Carol Service",
      fields.date ?? dayFromNow(7),
      fields.capacity ?? null,
      fields.signup_open ?? 1,
      fields.signup_closes ?? null,
      fields.ask_headcount ?? 1,
      fields.questions ?? "[]",
      new Date().toISOString(),
    )
    .run();
  return id;
}

/** YYYY-MM-DD in India time, `n` days from today. */
export function dayFromNow(n: number): string {
  return new Date(Date.now() + 5.5 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
}
