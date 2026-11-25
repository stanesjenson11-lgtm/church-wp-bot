import type { Role } from "../lib/shared/blocks";
import type { LoginStart, LoginStatus } from "../lib/shared/api";
import { nowIso, randomToken, sha256 } from "./store";

/**
 * Dashboard sign-in by WhatsApp. The dashboard shows "LOGIN 123456"; an admin
 * sends it to the bot from their own phone, Meta vouches for the sender (the
 * webhook is signed), and the waiting browser gets a session. No passwords,
 * no email, and no reply message, so it costs nothing.
 *
 * Sessions: a random 32-byte id in an HttpOnly, Secure, SameSite=Strict
 * cookie; D1 keeps only its SHA-256. 30 days, extended while in use.
 */

const SESSION_DAYS = 30;
const LOGIN_MINUTES = 5;
export const SESSION_COOKIE = "sid";
const PENDING_COOKIE = "pending";

export type Actor = { phone: string; name: string; role: Role; sessionHash: string };

const cookie = (name: string, value: string, maxAge: number, path = "/") =>
  `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function isAdmin(env: Env, phone: string): Promise<boolean> {
  return !!(await env.DB.prepare("SELECT 1 FROM admins WHERE phone = ?").bind(phone).first());
}

export async function startLogin(env: Env): Promise<{ body: LoginStart; setCookie: string } | null> {
  const now = nowIso();
  // A flood of open requests would only burn the free D1 write allowance.
  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_requests WHERE expires_at > ?").bind(now).first<{ n: number }>();
  if ((open?.n ?? 0) >= 50) return null;

  const secret = randomToken();
  const expiresAt = new Date(Date.now() + LOGIN_MINUTES * 60_000).toISOString();
  let code = "";
  for (let tries = 0; tries < 5 && !code; tries++) {
    const candidate = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");
    const taken = await env.DB.prepare("SELECT 1 FROM login_requests WHERE code = ? AND expires_at > ?").bind(candidate, now).first();
    if (!taken) code = candidate;
  }
  if (!code) return null;
  await env.DB.prepare("INSERT INTO login_requests (id, code, secret_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), code, await sha256(secret), expiresAt)
    .run();

  const bot = env.BOT_NUMBER.replace(/\D/g, "");
  return {
    body: { code, link: `https://wa.me/${bot}?text=${encodeURIComponent(`LOGIN ${code}`)}`, expiresAt, botNumber: bot },
    setCookie: cookie(PENDING_COOKIE, secret, LOGIN_MINUTES * 60, "/api/login"),
  };
}

/** Called by the bot when an admin sends "LOGIN <code>". */
export async function approveLogin(env: Env, code: string, phone: string): Promise<boolean> {
  const r = await env.DB.prepare("UPDATE login_requests SET approved_by = ? WHERE code = ? AND approved_by IS NULL AND expires_at > ?")
    .bind(phone, code, nowIso())
    .run();
  return r.meta.changes > 0;
}

/** The waiting browser asks whether its code has been sent yet. Single use. */
export async function pollLogin(env: Env, req: Request): Promise<{ status: LoginStatus; setCookies: string[] }> {
  const clearPending = cookie(PENDING_COOKIE, "", 0, "/api/login");
  const secret = readCookie(req, PENDING_COOKIE);
  if (!secret) return { status: "expired", setCookies: [] };
  const hash = await sha256(secret);
  const row = await env.DB.prepare("SELECT id, approved_by, expires_at FROM login_requests WHERE secret_hash = ?")
    .bind(hash)
    .first<{ id: string; approved_by: string | null; expires_at: string }>();
  if (!row || row.expires_at <= nowIso()) return { status: "expired", setCookies: [clearPending] };
  if (!row.approved_by) return { status: "pending", setCookies: [] };

  // Consume first, so the same approval can never mint two sessions.
  const used = await env.DB.prepare("DELETE FROM login_requests WHERE id = ?").bind(row.id).run();
  if (!used.meta.changes || !(await isAdmin(env, row.approved_by))) return { status: "expired", setCookies: [clearPending] };

  const sid = randomToken();
  await env.DB.prepare("INSERT INTO sessions (id_hash, phone, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256(sid), row.approved_by, (req.headers.get("user-agent") ?? "").slice(0, 200), nowIso(), expiry())
    .run();
  return { status: "approved", setCookies: [clearPending, cookie(SESSION_COOKIE, sid, SESSION_DAYS * 86_400)] };
}

const expiry = () => new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();

/** The signed-in admin, or null. Extends the session at most once a day. */
export async function currentActor(env: Env, req: Request): Promise<Actor | null> {
  const sid = readCookie(req, SESSION_COOKIE);
  if (!sid) return null;
  const sessionHash = await sha256(sid);
  const row = await env.DB.prepare(
    "SELECT s.expires_at, a.phone, a.name, a.role FROM sessions s JOIN admins a ON a.phone = s.phone WHERE s.id_hash = ? AND s.expires_at > ?",
  )
    .bind(sessionHash, nowIso())
    .first<{ expires_at: string; phone: string; name: string; role: Role }>();
  if (!row) return null;
  if (Date.parse(row.expires_at) - Date.now() < (SESSION_DAYS - 1) * 86_400_000) {
    await env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE id_hash = ?").bind(expiry(), sessionHash).run();
  }
  return { phone: row.phone, name: row.name, role: row.role, sessionHash };
}

export async function logout(env: Env, actor: Actor): Promise<string> {
  await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(actor.sessionHash).run();
  return cookie(SESSION_COOKIE, "", 0);
}

export async function revokeAllSessions(env: Env, phone: string): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE phone = ?").bind(phone).run();
}
