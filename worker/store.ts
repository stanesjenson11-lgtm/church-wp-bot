import { BLOCK_DATA, type Block, type BlockType } from "../lib/shared/blocks";
import { PRESETS, STARTER_KEYS } from "../lib/shared/presets";
import { DEFAULT_SETTINGS, type Settings } from "../lib/shared/settings";

/** Small shared helpers over D1: time, ids, settings, the menu, first-run seeding. */

export const nowIso = () => new Date().toISOString();

const IST_MS = 5.5 * 60 * 60 * 1000;
/** Today (or `days` from today) as YYYY-MM-DD in India time. */
export function istDay(days = 0): string {
  return new Date(Date.now() + IST_MS + days * 86_400_000).toISOString().slice(0, 10);
}

/** "Sun, 7 Dec" from YYYY-MM-DD. */
export function shortDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** A short random id for blocks, events and rows (not a secret). */
export function newId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

/** Random bytes as base64url, for secrets (session ids, login cookies). */
export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadSettings(env: Env): Promise<Settings> {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of results) if (key in settings) settings[key as keyof Settings] = value;
  return settings;
}

type BlockRow = {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  keywords: string;
  position: number;
  enabled: number;
  data: string;
  updated_at: string;
};

export function toBlock(r: BlockRow): Block {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    keywords: r.keywords,
    position: r.position,
    enabled: r.enabled === 1,
    data: JSON.parse(r.data),
    updatedAt: r.updated_at,
  } as Block;
}

export async function loadBlocks(env: Env): Promise<Block[]> {
  const { results } = await env.DB.prepare("SELECT * FROM blocks ORDER BY position, id").all<BlockRow>();
  return results.map(toBlock);
}

let seededHere = false;

/**
 * First run: the six starter blocks and the owner as admin. Runs once per
 * isolate; the `seeded` setting keeps it from re-adding blocks an admin
 * deleted. The owner is re-ensured so they can never lock themselves out.
 */
export async function ensureSeeded(env: Env): Promise<void> {
  if (seededHere) return;
  const owner = env.OWNER_PHONE?.replace(/\D/g, "");
  const stmts: D1PreparedStatement[] = [];
  if (owner) {
    stmts.push(
      env.DB.prepare("INSERT OR IGNORE INTO admins (phone, name, role, created_at) VALUES (?, 'Owner', 'admin', ?)").bind(owner, nowIso()),
    );
  }
  const done = await env.DB.prepare("SELECT 1 FROM settings WHERE key = 'seeded'").first();
  if (!done) {
    const now = nowIso();
    STARTER_KEYS.forEach((key, position) => {
      const p = PRESETS.find((x) => x.key === key)!;
      const data = BLOCK_DATA[p.block.type].parse(p.block.data);
      stmts.push(
        env.DB.prepare(
          "INSERT INTO blocks (id, type, title, description, keywords, position, enabled, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
        ).bind(newId(), p.block.type, p.block.title, p.block.description, p.block.keywords, position, JSON.stringify(data), now),
      );
    });
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('seeded', ?)").bind(now));
  }
  if (stmts.length) await env.DB.batch(stmts);
  seededHere = true;
}

/** Tests reset the database between files; they call this to re-seed. */
export function resetSeedMemo() {
  seededHere = false;
}
