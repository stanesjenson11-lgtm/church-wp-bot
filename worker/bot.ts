import { keywordList, type Block, type BlockDataMap } from "../lib/shared/blocks";
import type { Settings } from "../lib/shared/settings";
import { approveLogin, isAdmin, revokeAllSessions } from "./auth";
import { cancelRegistration, continueRegistration, eventCardById, eventsList, myEvents, startRegistration } from "./events";
import { ask, parse, type Input } from "./forms";
import { ensureSeeded, istDay, loadBlocks, loadSettings, newId, nowIso } from "./store";
import { buttons, ctaUrl, imageHeader, list, location, markRead, send, text, type Message } from "./whatsapp";

/**
 * The conversation. One inbound message in, at most one reply out.
 *
 * Reply ids: `menu`, `b:<block>`, `s:<block>:<item>`, `e:<event>`,
 * `r:<event>` (register), `x:<event>` (cancel), `a:<answer>` (inside a form).
 */

export type Inbound = { id: string; from: string; name: string; type: string; text?: string; replyId?: string };

export type State =
  | { k: "form"; b: string; i: number; a: Record<string, string> }
  | { k: "reg"; e: string; step: "count" | number; n: number; a: Record<string, string> };

export type Ctx = {
  env: Env;
  settings: Settings;
  /** Enabled blocks, in menu order. */
  blocks: Block[];
  from: string;
  name: string;
  /** This Worker's https origin, for image links. */
  origin: string;
  setState(state: State | null): Promise<void>;
  menu(lead?: string): Message;
};

const GREETINGS = new Set(["menu", "hi", "hello", "hey", "hai", "start", "praise the lord", "ptl"]);
const STATE_TTL_MS = 30 * 60 * 1000;

/** Handles one message from a member. Runs after the webhook has already answered Meta. */
export async function handleInbound(env: Env, m: Inbound, origin: string): Promise<void> {
  const now = nowIso();
  // A retried delivery from Meta must never get a second (billable) reply.
  const fresh = await env.DB.prepare("INSERT OR IGNORE INTO seen (msg_id, at) VALUES (?, ?)").bind(m.id, now).run();
  if (!fresh.meta.changes) return;

  await ensureSeeded(env);
  const [, settings, all, stateRow] = await Promise.all([
    env.DB.prepare(
      `INSERT INTO contacts (wa_id, name, first_seen, last_seen) VALUES (?1, ?2, ?3, ?3)
       ON CONFLICT (wa_id) DO UPDATE SET last_seen = ?3, name = CASE WHEN ?2 != '' THEN ?2 ELSE contacts.name END`,
    )
      .bind(m.from, m.name, now)
      .run(),
    loadSettings(env),
    loadBlocks(env),
    env.DB.prepare("SELECT state FROM chat_state WHERE wa_id = ? AND expires_at > ?").bind(m.from, now).first<{ state: string }>(),
    markRead(env, m.id),
  ]);

  const blocks = all.filter((b) => b.enabled).slice(0, 10);
  const c: Ctx = {
    env,
    settings,
    blocks,
    from: m.from,
    name: m.name,
    origin,
    async setState(state) {
      await (state
        ? env.DB.prepare(
            "INSERT INTO chat_state (wa_id, state, expires_at) VALUES (?, ?, ?) ON CONFLICT (wa_id) DO UPDATE SET state = excluded.state, expires_at = excluded.expires_at",
          ).bind(m.from, JSON.stringify(state), new Date(Date.now() + STATE_TTL_MS).toISOString())
        : env.DB.prepare("DELETE FROM chat_state WHERE wa_id = ?").bind(m.from)
      ).run();
    },
    menu: (lead) => menu(settings, blocks, lead),
  };

  const reply = await route(c, m, stateRow ? (JSON.parse(stateRow.state) as State) : null);
  if (reply) await send(env, m.from, reply);
}

async function route(c: Ctx, m: Inbound, state: State | null): Promise<Message | null> {
  const s = c.settings;
  const typed = m.type === "text" ? (m.text ?? "").trim() : "";
  const norm = typed.toLowerCase().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  const input: Input = { text: m.type === "text" ? typed : undefined, replyId: m.replyId };

  // Admin commands. A non-admin typing these just gets the menu.
  const login = /^login\s+(\d{6})$/i.exec(typed);
  if (login && (await isAdmin(c.env, m.from))) {
    await approveLogin(c.env, login[1]!, m.from);
    return null; // The blue ticks are the acknowledgement; a reply would cost a message.
  }
  if (norm === "logout all" && (await isAdmin(c.env, m.from))) {
    await revokeAllSessions(c.env, m.from);
    return text(s.logged_out);
  }

  if (norm === "delete my data") {
    await c.env.DB.batch(
      ["contacts", "registrations", "submissions", "chat_state"].map((t) => c.env.DB.prepare(`DELETE FROM ${t} WHERE wa_id = ?`).bind(m.from)),
    );
    return text(s.deleted);
  }

  if (state) {
    if (norm === "cancel") {
      await c.setState(null);
      return buttons(s.cancelled, [{ id: "menu", title: s.menu_label }]);
    }
    if (norm === "menu" || m.replyId === "menu") {
      await c.setState(null);
      return c.menu();
    }
    // A tap on an older message (another menu item) leaves the form behind.
    if (m.replyId && !m.replyId.startsWith("a:")) {
      await c.setState(null);
    } else if (m.type !== "text" && !m.replyId) {
      return text(s.text_only);
    } else {
      return state.k === "form" ? continueForm(c, state, input) : continueRegistration(c, state, input);
    }
  }

  if (m.replyId) return reply(c, m.replyId);
  if (m.type !== "text") return c.menu(s.unsupported);
  if (GREETINGS.has(norm)) return c.menu();
  if (norm === "my events" || norm === "my event") return myEvents(c);

  const n = /^\d{1,2}$/.test(norm) ? Number(norm) : 0;
  const block =
    (n >= 1 ? c.blocks[n - 1] : undefined) ??
    c.blocks.find((b) => b.title.toLowerCase() === norm || keywordList(b.keywords).includes(norm));
  if (block) return open(c, block);

  // Future: answer from the church's own content with AI here, before falling back to the menu.
  return c.menu();
}

/** Taps on buttons and list rows. */
async function reply(c: Ctx, id: string): Promise<Message> {
  const [kind, a = "", b = ""] = id.split(":");
  switch (kind) {
    case "b": {
      const block = c.blocks.find((x) => x.id === a);
      return block ? open(c, block) : c.menu();
    }
    case "s": {
      const block = c.blocks.find((x) => x.id === a && x.type === "submenu");
      const item = block && (block.data as BlockDataMap["submenu"]).items.find((i) => i.id === b);
      return item ? buttons(item.body, [{ id: "menu", title: c.settings.menu_label }]) : c.menu();
    }
    case "e":
      return (await eventCardById(c, a)) ?? c.menu();
    case "r":
      return startRegistration(c, a);
    case "x":
      return cancelRegistration(c, a);
    default:
      return c.menu();
  }
}

function menu(s: Settings, blocks: Block[], lead?: string): Message {
  const body = lead ? `${lead}\n\n${s.welcome}` : s.welcome;
  if (blocks.length === 0) return text(body);
  return list(body, s.menu_button, [
    { title: s.menu_section, rows: blocks.map((b) => ({ id: `b:${b.id}`, title: b.title, description: b.description })) },
  ]);
}

/** Opens a menu item: exactly one message whatever its type. */
async function open(c: Ctx, block: Block): Promise<Message> {
  await c.env.DB.prepare("INSERT INTO taps (day, block_id, n) VALUES (?, ?, 1) ON CONFLICT (day, block_id) DO UPDATE SET n = n + 1")
    .bind(istDay(), block.id)
    .run();
  const back = { id: "menu", title: c.settings.menu_label };

  switch (block.type) {
    case "text": {
      const d = block.data;
      const header = d.imageId ? imageHeader(`${c.origin}/media/${d.imageId}`) : undefined;
      if (d.link) return ctaUrl(d.body, d.link.label, d.link.url, header);
      // Over 1,024 characters only fits a plain text message (no button, no image).
      return d.body.length > 1024 && !header ? text(d.body) : buttons(d.body, [back], { header });
    }
    case "location": {
      const d = block.data;
      return location(d.latitude, d.longitude, d.name, d.address);
    }
    case "events":
      return eventsList(c, block.data.intro, block.data.empty);
    case "form": {
      const d = block.data;
      await c.setState({ k: "form", b: block.id, i: 0, a: {} });
      return ask(c.settings, d.questions[0]!, 0, d.questions.length, d.intro);
    }
    case "submenu": {
      const d = block.data;
      const rows = d.items.map((i) => ({ id: `s:${block.id}:${i.id}`, title: i.title, description: i.description }));
      const sections = [{ title: block.title, rows }];
      if (rows.length < 10) sections.push({ title: c.settings.menu_section, rows: [{ id: "menu", title: `← ${c.settings.menu_label}`, description: "" }] });
      return list(d.intro, d.button, sections);
    }
    case "verse": {
      const verses = block.data.verses;
      const day = Math.floor(Date.parse(`${istDay()}T00:00:00Z`) / 86_400_000);
      return buttons(verses[day % verses.length]!, [back]);
    }
  }
}

async function continueForm(c: Ctx, state: Extract<State, { k: "form" }>, input: Input): Promise<Message> {
  const block = c.blocks.find((b) => b.id === state.b && b.type === "form");
  if (!block || block.type !== "form") {
    await c.setState(null);
    return c.menu();
  }
  const { questions, thanks } = block.data;
  const q = questions[state.i]!;
  const answer = parse(c.settings, q, input);
  if (!answer.ok) return ask(c.settings, q, state.i, questions.length, answer.error);

  const answers = { ...state.a, [q.id]: answer.value };
  if (state.i + 1 < questions.length) {
    await c.setState({ ...state, i: state.i + 1, a: answers });
    return ask(c.settings, questions[state.i + 1]!, state.i + 1, questions.length);
  }

  await c.setState(null);
  const rows = questions.map((x) => ({ label: x.label, value: answers[x.id] ?? "" }));
  try {
    await c.env.DB.prepare(
      "INSERT INTO submissions (id, block_id, block_title, wa_id, name, data, private, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)",
    )
      .bind(newId(), block.id, block.title, c.from, c.name, JSON.stringify(rows), block.data.private ? 1 : 0, nowIso())
      .run();
  } catch (err) {
    // Never the answers or the phone number: a prayer request is private.
    console.error("submission save failed", err instanceof Error ? err.name : "unknown");
    return text(c.settings.save_failed.replace("{office_phone}", c.settings.office_phone));
  }
  await notify(c, block.title, rows);
  return buttons(thanks, [{ id: "menu", title: c.settings.menu_label }]);
}

/** Optional email through the Apps Script relay (apps-script/Code.gs). Best effort. */
async function notify(c: Ctx, title: string, rows: { label: string; value: string }[]) {
  const { MAIL_RELAY_URL: url, MAIL_RELAY_KEY: key } = c.env;
  if (!url || !key) return;
  const body = [`From: ${c.name || "(no name)"} (+${c.from})`, "", ...rows.map((r) => `${r.label}\n${r.value || "-"}\n`)].join("\n");
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, subject: `New ${title} — ${c.settings.church_name}`, body }),
  })
    .then((r) => !r.ok && console.error("mail relay failed", r.status))
    .catch(() => console.error("mail relay failed"));
}
