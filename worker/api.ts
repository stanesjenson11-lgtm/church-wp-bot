import { z } from "zod";

import type { AdminRow, Me, Overview, Person, Registration, SessionRow, Submission, UsageMonth } from "../lib/shared/api";
import { AdminInputSchema, BlockInputSchema, EventInputSchema, LIMITS, type BlockInput } from "../lib/shared/blocks";
import { SETTING_FIELDS } from "../lib/shared/settings";
import { currentActor, keyLogin, logout, pollLogin, startLogin, type Actor } from "./auth";
import { EVENT_SELECT, toEvent } from "./events";
import { ensureSeeded, istDay, loadBlocks, loadSettings, newId, nowIso, toBlock } from "./store";

/**
 * The dashboard's JSON API (contract in lib/shared/api.ts). This is the
 * authorisation boundary: every route checks the session and role itself;
 * the dashboard's redirects are only convenience.
 */

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: unknown,
  ) {
    super(message);
  }
}

const json = (data: unknown, status = 200, cookies: string[] = []) => {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(JSON.stringify(data), { status, headers });
};
const ok = () => json({ ok: true });

function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const first = r.error.issues[0]!;
  const where = first.path.length ? `${first.path.join(" › ")}: ` : "";
  throw new HttpError(400, `${where}${first.message}`, z.flattenError(r.error));
}

async function body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body");
  }
}

type Route = {
  method: string;
  pattern: URLPattern;
  /** Who may call it. `public` routes need no session. */
  role: "public" | "any" | "admin";
  run: (a: { req: Request; env: Env; actor: Actor; params: Record<string, string>; url: URL }) => Promise<Response>;
};

const routes: Route[] = [];
const route = (method: string, path: string, role: Route["role"], run: Route["run"]) =>
  routes.push({ method, pattern: new URLPattern({ pathname: `/api${path}` }), role, run });

export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  // A cross-site page can't set a custom header without CORS approval, which
  // this API never gives: together with SameSite=Strict, that stops CSRF.
  if (req.method !== "GET" && req.headers.get("x-church") !== "1") return json({ error: "Missing x-church header" }, 403);

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const match = r.pattern.exec(url);
    if (!match) continue;
    try {
      await ensureSeeded(env);
      const found = r.role === "public" ? null : await currentActor(env, req);
      if (r.role !== "public" && !found) return json({ error: "Please sign in" }, 401);
      if (r.role === "admin" && found?.role !== "admin") return json({ error: "Only admins can do that" }, 403);
      // Public routes never read `actor`.
      const actor = found as Actor;
      const params = Object.fromEntries(
        Object.entries(match.pathname.groups).map(([k, v]) => [k, decodeURIComponent(v ?? "")]),
      );
      return await r.run({ req, env, actor, params, url });
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, issues: err.issues }, err.status);
      console.error("api error", req.method, url.pathname, err instanceof Error ? err.message : "unknown");
      return json({ error: "Something went wrong" }, 500);
    }
  }
  return json({ error: "Not found" }, 404);
}

// ---- Sign-in ---------------------------------------------------------------

route("POST", "/login/start", "public", async ({ env }) => {
  if (!env.BOT_NUMBER) throw new HttpError(503, "The bot's WhatsApp number isn't set up yet (BOT_NUMBER secret).");
  const started = await startLogin(env);
  if (!started) throw new HttpError(429, "Too many sign-in attempts right now. Try again in a few minutes.");
  return json(started.body, 200, [started.setCookie]);
});

route("POST", "/login/key", "public", async ({ req, env }) => {
  const { key } = validate(z.object({ key: z.string().min(1).max(200) }), await body(req));
  const setCookie = await keyLogin(env, req, key);
  if (!setCookie) throw new HttpError(403, env.SETUP_KEY ? "That setup key isn't right" : "Setup-key sign-in is turned off");
  return json({ ok: true }, 200, [setCookie]);
});

route("POST", "/login/poll", "public", async ({ req, env }) => {
  const { status, setCookies } = await pollLogin(env, req);
  return json({ status }, 200, setCookies);
});

route("POST", "/logout", "any", async ({ env, actor }) => json({ ok: true }, 200, [await logout(env, actor)]));

route("GET", "/me", "any", async ({ env, actor }) => {
  const settings = await loadSettings(env);
  const me: Me = { phone: actor.phone, name: actor.name, role: actor.role, botNumber: env.BOT_NUMBER, churchName: settings.church_name };
  return json(me);
});

// ---- Overview --------------------------------------------------------------

async function usageFor(env: Env, month: string, sent: number) {
  const s = await loadSettings(env);
  const free = Number(s.free_per_month) || 0;
  const rate = Number(s.rate_per_message) || 0;
  const paid = Math.max(0, sent - free);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const resetsOn = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { month, sent, free, paid, rate, cost: Math.round(paid * rate * 100) / 100, resetsOn };
}

route("GET", "/overview", "any", async ({ env, actor }) => {
  const today = istDay();
  const month = today.slice(0, 7);
  const since = istDay(-29);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const privateFilter = actor.role === "admin" ? "" : "AND private = 0";

  const [monthSent, daily, people, inbox, upcoming, taps, last] = await env.DB.batch([
    env.DB.prepare("SELECT COALESCE(SUM(sent), 0) AS n FROM usage WHERE day >= ?").bind(`${month}-01`),
    env.DB.prepare("SELECT day, sent FROM usage WHERE day >= ? ORDER BY day").bind(since),
    env.DB.prepare(
      "SELECT COUNT(*) AS total, SUM(first_seen >= ?1) AS new_week, SUM(last_seen >= ?1) AS active_week FROM contacts",
    ).bind(weekAgo),
    env.DB.prepare(
      `SELECT block_id, block_title, COUNT(*) AS n FROM submissions WHERE status = 'new' ${privateFilter} GROUP BY block_id ORDER BY n DESC`,
    ),
    env.DB.prepare(`${EVENT_SELECT} WHERE e.date >= ? ORDER BY e.date, e.time LIMIT 5`).bind(today),
    env.DB.prepare(
      "SELECT t.block_id, b.title, SUM(t.n) AS n FROM taps t JOIN blocks b ON b.id = t.block_id WHERE t.day >= ? GROUP BY t.block_id ORDER BY n DESC",
    ).bind(since),
    env.DB.prepare("SELECT MAX(last_seen) AS at FROM contacts"),
  ]);

  const byDay = new Map((daily!.results as { day: string; sent: number }[]).map((r) => [r.day, r.sent]));
  const p = people!.results[0] as { total: number; new_week: number | null; active_week: number | null };
  const overview: Overview = {
    usage: await usageFor(env, month, Number((monthSent!.results[0] as { n: number }).n)),
    daily: Array.from({ length: 30 }, (_, i) => {
      const day = istDay(i - 29);
      return { day, sent: byDay.get(day) ?? 0 };
    }),
    people: { total: p.total, newThisWeek: p.new_week ?? 0, activeThisWeek: p.active_week ?? 0 },
    inbox: (inbox!.results as { block_id: string; block_title: string; n: number }[]).map((r) => ({
      blockId: r.block_id,
      title: r.block_title,
      count: r.n,
    })),
    upcoming: (upcoming!.results as Parameters<typeof toEvent>[0][]).map(toEvent),
    taps: (taps!.results as { block_id: string; title: string; n: number }[]).map((r) => ({ blockId: r.block_id, title: r.title, n: r.n })),
    lastMessageAt: (last!.results[0] as { at: string | null }).at,
  };
  return json(overview);
});

// ---- Menu blocks -----------------------------------------------------------

/** Form question ids and list item ids must be unique, or answers would overwrite each other. */
function checkIds(input: BlockInput) {
  const ids =
    input.type === "form" ? input.data.questions.map((q) => q.id) : input.type === "submenu" ? input.data.items.map((i) => i.id) : [];
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "Two questions or items have the same id");
}

async function checkMenuRoom(env: Env, input: BlockInput, exceptId = "") {
  if (!input.enabled) return;
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM blocks WHERE enabled = 1 AND id != ?").bind(exceptId).first<{ n: number }>();
  if ((n?.n ?? 0) >= LIMITS.listRows) {
    throw new HttpError(400, `WhatsApp menus hold ${LIMITS.listRows} items. Turn one off, or put items inside a list.`);
  }
}

async function getBlock(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT * FROM blocks WHERE id = ?").bind(id).first<Parameters<typeof toBlock>[0]>();
  if (!row) throw new HttpError(404, "That menu item no longer exists");
  return toBlock(row);
}

route("GET", "/blocks", "any", async ({ env }) => json(await loadBlocks(env)));

route("POST", "/blocks", "any", async ({ req, env }) => {
  const input = validate(BlockInputSchema, await body(req));
  checkIds(input);
  await checkMenuRoom(env, input);
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO blocks (id, type, title, description, keywords, position, enabled, data, updated_at)
     VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM blocks), ?, ?, ?)`,
  )
    .bind(id, input.type, input.title, input.description, input.keywords, input.enabled ? 1 : 0, JSON.stringify(input.data), nowIso())
    .run();
  return json(await getBlock(env, id), 201);
});

route("PUT", "/blocks/:id", "any", async ({ req, env, params }) => {
  const input = validate(BlockInputSchema, await body(req));
  checkIds(input);
  await checkMenuRoom(env, input, params.id);
  const r = await env.DB.prepare(
    "UPDATE blocks SET type = ?, title = ?, description = ?, keywords = ?, enabled = ?, data = ?, updated_at = ? WHERE id = ?",
  )
    .bind(input.type, input.title, input.description, input.keywords, input.enabled ? 1 : 0, JSON.stringify(input.data), nowIso(), params.id)
    .run();
  if (!r.meta.changes) throw new HttpError(404, "That menu item no longer exists");
  return json(await getBlock(env, params.id!));
});

route("DELETE", "/blocks/:id", "any", async ({ env, params }) => {
  await env.DB.prepare("DELETE FROM blocks WHERE id = ?").bind(params.id).run();
  return ok();
});

route("POST", "/blocks/order", "any", async ({ req, env }) => {
  const { ids } = validate(z.object({ ids: z.array(z.string().max(40)).max(100) }), await body(req));
  if (ids.length) await env.DB.batch(ids.map((id, i) => env.DB.prepare("UPDATE blocks SET position = ? WHERE id = ?").bind(i, id)));
  return ok();
});

// ---- Events ----------------------------------------------------------------

async function getEvent(env: Env, id: string) {
  const row = await env.DB.prepare(`${EVENT_SELECT} WHERE e.id = ?`).bind(id).first<Parameters<typeof toEvent>[0]>();
  if (!row) throw new HttpError(404, "That event no longer exists");
  return toEvent(row);
}

route("GET", "/events", "any", async ({ env }) => {
  const today = istDay();
  const { results } = await env.DB.prepare(
    `${EVENT_SELECT} ORDER BY (e.date < ?) , CASE WHEN e.date >= ? THEN e.date END ASC, e.date DESC, e.time`,
  )
    .bind(today, today)
    .all<Parameters<typeof toEvent>[0]>();
  return json(results.map(toEvent));
});

const eventValues = (e: z.infer<typeof EventInputSchema>) => [
  e.title,
  e.date,
  e.time,
  e.venue,
  e.details,
  e.imageId,
  e.capacity,
  e.signupOpen ? 1 : 0,
  e.signupCloses,
  e.askHeadcount ? 1 : 0,
  JSON.stringify(e.questions),
];

route("POST", "/events", "any", async ({ req, env }) => {
  const e = validate(EventInputSchema, await body(req));
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO events (title, date, time, venue, details, image_id, capacity, signup_open, signup_closes, ask_headcount, questions, id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(...eventValues(e), id, nowIso())
    .run();
  return json(await getEvent(env, id), 201);
});

route("PUT", "/events/:id", "any", async ({ req, env, params }) => {
  const e = validate(EventInputSchema, await body(req));
  const r = await env.DB.prepare(
    `UPDATE events SET title = ?, date = ?, time = ?, venue = ?, details = ?, image_id = ?, capacity = ?, signup_open = ?,
     signup_closes = ?, ask_headcount = ?, questions = ? WHERE id = ?`,
  )
    .bind(...eventValues(e), params.id)
    .run();
  if (!r.meta.changes) throw new HttpError(404, "That event no longer exists");
  return json(await getEvent(env, params.id!));
});

route("DELETE", "/events/:id", "any", async ({ env, params }) => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM registrations WHERE event_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM events WHERE id = ?").bind(params.id),
  ]);
  return ok();
});

type RegistrationRow = {
  id: string;
  event_id: string;
  wa_id: string;
  name: string;
  headcount: number;
  answers: string;
  status: Registration["status"];
  checked_in: number;
  created_at: string;
};
const toRegistration = (r: RegistrationRow): Registration => ({
  id: r.id,
  eventId: r.event_id,
  waId: r.wa_id,
  name: r.name,
  headcount: r.headcount,
  answers: JSON.parse(r.answers),
  status: r.status,
  checkedIn: r.checked_in === 1,
  createdAt: r.created_at,
});

route("GET", "/events/:id/registrations", "any", async ({ env, params }) => {
  const { results } = await env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? ORDER BY status, created_at")
    .bind(params.id)
    .all<RegistrationRow>();
  return json(results.map(toRegistration));
});

route("PATCH", "/registrations/:id", "any", async ({ req, env, params }) => {
  const p = validate(z.object({ checkedIn: z.boolean().optional(), status: z.enum(["confirmed", "cancelled"]).optional() }), await body(req));
  const row = await env.DB.prepare(
    "UPDATE registrations SET checked_in = COALESCE(?, checked_in), status = COALESCE(?, status) WHERE id = ? RETURNING *",
  )
    .bind(p.checkedIn === undefined ? null : p.checkedIn ? 1 : 0, p.status ?? null, params.id)
    .first<RegistrationRow>();
  if (!row) throw new HttpError(404, "That registration no longer exists");
  return json(toRegistration(row));
});

// ---- Inbox -----------------------------------------------------------------

type SubmissionRow = {
  id: string;
  block_id: string;
  block_title: string;
  wa_id: string;
  name: string;
  data: string;
  private: number;
  status: Submission["status"];
  created_at: string;
};
const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  blockId: r.block_id,
  blockTitle: r.block_title,
  waId: r.wa_id,
  name: r.name,
  answers: JSON.parse(r.data),
  private: r.private === 1,
  status: r.status,
  createdAt: r.created_at,
});
/** Editors never see private items (prayer requests, pastoral visits). */
const visible = (actor: Actor) => (actor.role === "admin" ? "1 = 1" : "private = 0");

route("GET", "/submissions", "any", async ({ env, actor, url }) => {
  const block = url.searchParams.get("block");
  const { results } = await env.DB.prepare(
    `SELECT * FROM submissions WHERE ${visible(actor)} ${block ? "AND block_id = ?" : ""} ORDER BY created_at DESC LIMIT 500`,
  )
    .bind(...(block ? [block] : []))
    .all<SubmissionRow>();
  return json(results.map(toSubmission));
});

route("PATCH", "/submissions/:id", "any", async ({ req, env, actor, params }) => {
  const { status } = validate(z.object({ status: z.enum(["new", "in_progress", "done"]) }), await body(req));
  const row = await env.DB.prepare(`UPDATE submissions SET status = ? WHERE id = ? AND ${visible(actor)} RETURNING *`)
    .bind(status, params.id)
    .first<SubmissionRow>();
  if (!row) throw new HttpError(404, "That item no longer exists");
  return json(toSubmission(row));
});

route("DELETE", "/submissions/:id", "any", async ({ env, actor, params }) => {
  await env.DB.prepare(`DELETE FROM submissions WHERE id = ? AND ${visible(actor)}`).bind(params.id).run();
  return ok();
});

// ---- People ----------------------------------------------------------------

route("GET", "/people", "any", async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT c.*,
       (SELECT COUNT(*) FROM registrations r WHERE r.wa_id = c.wa_id AND r.status = 'confirmed') AS registrations,
       (SELECT COUNT(*) FROM submissions s WHERE s.wa_id = c.wa_id) AS submissions
     FROM contacts c ORDER BY c.last_seen DESC LIMIT 2000`,
  ).all<{ wa_id: string; name: string; first_seen: string; last_seen: string; registrations: number; submissions: number }>();
  const people: Person[] = results.map((r) => ({
    waId: r.wa_id,
    name: r.name,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    registrations: r.registrations,
    submissions: r.submissions,
  }));
  return json(people);
});

route("DELETE", "/people/:waId", "admin", async ({ env, params }) => {
  await env.DB.batch(
    ["contacts", "registrations", "submissions", "chat_state"].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE wa_id = ?`).bind(params.waId)),
  );
  return ok();
});

// ---- Settings --------------------------------------------------------------

const SettingsPatch = z
  .record(z.string(), z.string())
  .superRefine((obj, ctx) => {
    for (const [key, value] of Object.entries(obj)) {
      const field = SETTING_FIELDS.find((f) => f.key === key);
      if (!field) ctx.addIssue({ code: "custom", message: "Unknown setting", path: [key] });
      else if (value.length > field.max) ctx.addIssue({ code: "custom", message: `${field.label} must be ${field.max} characters or less`, path: [key] });
    }
  });

route("GET", "/settings", "any", async ({ env }) => json(await loadSettings(env)));

route("PUT", "/settings", "any", async ({ req, env }) => {
  const patch = validate(SettingsPatch, await body(req));
  const entries = Object.entries(patch);
  if (entries.length) {
    await env.DB.batch(
      entries.map(([k, v]) =>
        env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(k, v),
      ),
    );
  }
  return json(await loadSettings(env));
});

// ---- Admins and sessions ---------------------------------------------------

route("GET", "/admins", "admin", async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT phone, name, role, created_at FROM admins ORDER BY created_at").all<{
    phone: string;
    name: string;
    role: AdminRow["role"];
    created_at: string;
  }>();
  return json(results.map((r): AdminRow => ({ phone: r.phone, name: r.name, role: r.role, createdAt: r.created_at })));
});

route("POST", "/admins", "admin", async ({ req, env }) => {
  const a = validate(AdminInputSchema, await body(req));
  const createdAt = nowIso();
  await env.DB.prepare(
    "INSERT INTO admins (phone, name, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (phone) DO UPDATE SET name = excluded.name, role = excluded.role",
  )
    .bind(a.phone, a.name, a.role, createdAt)
    .run();
  return json({ ...a, createdAt } satisfies AdminRow, 201);
});

route("DELETE", "/admins/:phone", "admin", async ({ env, actor, params }) => {
  if (params.phone === actor.phone) throw new HttpError(400, "You can't remove yourself");
  if (params.phone === env.OWNER_PHONE?.replace(/\D/g, "")) throw new HttpError(400, "The owner can't be removed");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE phone = ?").bind(params.phone),
    env.DB.prepare("DELETE FROM admins WHERE phone = ?").bind(params.phone),
  ]);
  return ok();
});

route("GET", "/sessions", "admin", async ({ env, actor }) => {
  const { results } = await env.DB.prepare(
    "SELECT s.id_hash, s.phone, a.name, s.user_agent, s.created_at, s.expires_at FROM sessions s JOIN admins a ON a.phone = s.phone WHERE s.expires_at > ? ORDER BY s.created_at DESC",
  )
    .bind(nowIso())
    .all<{ id_hash: string; phone: string; name: string; user_agent: string; created_at: string; expires_at: string }>();
  return json(
    results.map(
      (r): SessionRow => ({
        id: r.id_hash,
        phone: r.phone,
        name: r.name,
        userAgent: r.user_agent,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        current: r.id_hash === actor.sessionHash,
      }),
    ),
  );
});

route("DELETE", "/sessions/:id", "admin", async ({ env, params }) => {
  await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(params.id).run();
  return ok();
});

// ---- Usage -----------------------------------------------------------------

route("GET", "/usage", "any", async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT substr(day, 1, 7) AS month, SUM(sent) AS sent FROM usage GROUP BY month ORDER BY month DESC LIMIT 24",
  ).all<{ month: string; sent: number }>();
  const months: UsageMonth[] = [];
  for (const r of results) {
    const u = await usageFor(env, r.month, r.sent);
    months.push({ month: r.month, sent: r.sent, paid: u.paid, cost: u.cost });
  }
  return json(months);
});

// ---- Media -----------------------------------------------------------------

const MAX_MEDIA = 1_500_000; // D1 rows top out at 2 MB.

route("POST", "/media", "any", async ({ req, env }) => {
  const mime = (req.headers.get("content-type") ?? "").split(";")[0]!.trim();
  // WhatsApp image messages accept only JPEG and PNG.
  if (mime !== "image/jpeg" && mime !== "image/png") throw new HttpError(415, "Please upload a JPEG or PNG image");
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) throw new HttpError(400, "The image is empty");
  if (bytes.byteLength > MAX_MEDIA) throw new HttpError(413, "The image must be under 1.5 MB");
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO media (id, mime, bytes, created_at) VALUES (?, ?, ?, ?)").bind(id, mime, bytes, nowIso()).run();
  return json({ id, url: `/media/${id}` }, 201);
});

export async function serveMedia(env: Env, id: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare("SELECT mime, bytes FROM media WHERE id = ?").bind(id).first<{ mime: string; bytes: ArrayBuffer }>();
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "content-type": row.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
