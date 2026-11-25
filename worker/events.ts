import { clip, type ChurchEvent, type Question } from "../lib/shared/blocks";
import { fill } from "../lib/shared/settings";
import type { Ctx, State } from "./bot";
import { ask, parse, type Input } from "./forms";
import { istDay, newId, nowIso, shortDate } from "./store";
import { buttons, imageHeader, list, type Message } from "./whatsapp";

/** Events in the chat: the list, one event's card, registering, cancelling, "my events". */

type EventRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  details: string;
  image_id: string | null;
  capacity: number | null;
  signup_open: number;
  signup_closes: string | null;
  ask_headcount: number;
  questions: string;
  registered: number;
  registrations: number;
};

/** Every event column plus confirmed headcount and registration count. */
export const EVENT_SELECT = `
  SELECT e.*,
    COALESCE((SELECT SUM(headcount) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed'), 0) AS registered,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS registrations
  FROM events e`;

export function toEvent(r: EventRow): ChurchEvent {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    time: r.time,
    venue: r.venue,
    details: r.details,
    imageId: r.image_id,
    capacity: r.capacity,
    signupOpen: r.signup_open === 1,
    signupCloses: r.signup_closes,
    askHeadcount: r.ask_headcount === 1,
    questions: JSON.parse(r.questions) as Question[],
    registered: Number(r.registered),
    registrations: Number(r.registrations),
  };
}

async function getEvent(c: Ctx, id: string): Promise<ChurchEvent | null> {
  const row = await c.env.DB.prepare(`${EVENT_SELECT} WHERE e.id = ?`).bind(id).first<EventRow>();
  return row ? toEvent(row) : null;
}

const menuButton = (c: Ctx) => ({ id: "menu", title: c.settings.menu_label });
const people = (c: Ctx, n: number) => (n === 1 ? c.settings.people_one : fill(c.settings.people_many, { n }));
const when = (e: ChurchEvent) => `🗓️ ${shortDate(e.date)}${e.time ? ` · ${e.time}` : ""}${e.venue ? `\n📍 ${e.venue}` : ""}`;

/** Why a member can't register right now, or null if they can. */
function blocked(c: Ctx, e: ChurchEvent, extra = 0): string | null {
  const today = istDay();
  if (!e.signupOpen) return "";
  if (today > (e.signupCloses ?? e.date) || today > e.date) return c.settings.closed;
  if (e.capacity !== null && e.registered + extra >= e.capacity) return c.settings.full;
  return null;
}

/** The "Upcoming Events" block: a list, or the card itself when there is only one. */
export async function eventsList(c: Ctx, intro: string, empty: string): Promise<Message> {
  const { results } = await c.env.DB.prepare(`${EVENT_SELECT} WHERE e.date >= ? ORDER BY e.date, e.time LIMIT 10`)
    .bind(istDay())
    .all<EventRow>();
  const events = results.map(toEvent);
  if (events.length === 0) return buttons(empty, [menuButton(c)]);
  if (events.length === 1) return eventCard(c, events[0]!);
  return list(intro, c.settings.events_button, [
    {
      title: c.settings.events_button,
      rows: events.map((e) => {
        const left = e.capacity === null ? "" : ` · ${Math.max(0, e.capacity - e.registered)} left`;
        return { id: `e:${e.id}`, title: e.title, description: `${shortDate(e.date)}${e.time ? ` · ${e.time}` : ""}${left}` };
      }),
    },
  ]);
}

export async function eventCardById(c: Ctx, id: string): Promise<Message | null> {
  const e = await getEvent(c, id);
  return e ? eventCard(c, e) : null;
}

async function eventCard(c: Ctx, e: ChurchEvent): Promise<Message> {
  const mine = await c.env.DB.prepare("SELECT headcount FROM registrations WHERE event_id = ? AND wa_id = ? AND status = 'confirmed'")
    .bind(e.id, c.from)
    .first<{ headcount: number }>();
  let body = `*${e.title}*\n${when(e)}${e.details ? `\n\n${e.details}` : ""}`;
  const header = e.imageId ? imageHeader(`${c.origin}/media/${e.imageId}`) : undefined;

  if (mine) {
    body += `\n\n${fill(c.settings.already_registered, { people: people(c, mine.headcount) })}`;
    return buttons(body, [{ id: `x:${e.id}`, title: c.settings.unregister }, menuButton(c)], { header });
  }
  const reason = blocked(c, e);
  if (reason !== null) return buttons(reason ? `${body}\n\n${reason}` : body, [menuButton(c)], { header });
  return buttons(body, [{ id: `r:${e.id}`, title: c.settings.register }, menuButton(c)], { header });
}

/** [Register] tapped: ask how many, then any extra questions, then save. */
export async function startRegistration(c: Ctx, id: string): Promise<Message> {
  const e = await getEvent(c, id);
  if (!e) return c.menu();
  const reason = blocked(c, e);
  if (reason !== null) return buttons(reason || c.settings.closed, [menuButton(c)]);
  if (e.askHeadcount) {
    await c.setState({ k: "reg", e: e.id, step: "count", n: 1, a: {} });
    return headcountQuestion(c);
  }
  return nextQuestionOrFinish(c, e, { k: "reg", e: e.id, step: 0, n: 1, a: {} });
}

function headcountQuestion(c: Ctx, lead = ""): Message {
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: `a:${i + 1}`, title: String(i + 1), description: people(c, i + 1) }));
  return list(lead ? `${lead}\n\n${c.settings.headcount}` : c.settings.headcount, c.settings.choose, [{ title: c.settings.choose, rows }], {
    footer: c.settings.cancel_hint,
  });
}

/** A reply while registering. */
export async function continueRegistration(c: Ctx, state: Extract<State, { k: "reg" }>, input: Input): Promise<Message> {
  const e = await getEvent(c, state.e);
  if (!e) {
    await c.setState(null);
    return c.menu();
  }
  if (state.step === "count") {
    const fromList = input.replyId?.startsWith("a:") ? input.replyId.slice(2) : (input.text?.trim() ?? "");
    const n = /^\d{1,2}$/.test(fromList) ? Number(fromList) : 0;
    if (n < 1 || n > 50) return headcountQuestion(c, c.settings.invalid_number);
    return nextQuestionOrFinish(c, e, { ...state, step: 0, n });
  }
  const q = e.questions[state.step];
  if (!q) return finish(c, e, state);
  const answer = parse(c.settings, q, input);
  if (!answer.ok) return ask(c.settings, q, state.step, e.questions.length, answer.error);
  return nextQuestionOrFinish(c, e, { ...state, step: state.step + 1, a: { ...state.a, [q.id]: answer.value } });
}

async function nextQuestionOrFinish(c: Ctx, e: ChurchEvent, state: Extract<State, { k: "reg" }>): Promise<Message> {
  const step = state.step as number;
  const q = e.questions[step];
  if (!q) return finish(c, e, state);
  await c.setState(state);
  return ask(c.settings, q, step, e.questions.length, step === 0 ? `*${e.title}*` : "");
}

/**
 * Saves the registration if it still fits. One statement, so two members
 * taking the last seats at once can't both get in. Registering again updates
 * the member's existing row.
 */
async function finish(c: Ctx, e: ChurchEvent, state: Extract<State, { k: "reg" }>): Promise<Message> {
  await c.setState(null);
  const result = await c.env.DB.prepare(
    `INSERT INTO registrations (id, event_id, wa_id, name, headcount, answers, status, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'confirmed', ?7
     WHERE (SELECT capacity FROM events WHERE id = ?2) IS NULL
        OR (SELECT COALESCE(SUM(headcount), 0) FROM registrations
            WHERE event_id = ?2 AND status = 'confirmed' AND wa_id != ?3) + ?5
           <= (SELECT capacity FROM events WHERE id = ?2)
     ON CONFLICT (event_id, wa_id) DO UPDATE SET
       name = excluded.name, headcount = excluded.headcount, answers = excluded.answers,
       status = 'confirmed', created_at = excluded.created_at`,
  )
    .bind(newId(), e.id, c.from, c.name, state.n, JSON.stringify(state.a), nowIso())
    .run();
  if (!result.meta.changes) return buttons(c.settings.full, [menuButton(c)]);
  return buttons(fill(c.settings.registered, { title: e.title, when: when(e), people: people(c, state.n) }), [menuButton(c)]);
}

export async function cancelRegistration(c: Ctx, id: string): Promise<Message> {
  const e = await getEvent(c, id);
  if (!e) return c.menu();
  await c.env.DB.prepare("UPDATE registrations SET status = 'cancelled' WHERE event_id = ? AND wa_id = ?").bind(id, c.from).run();
  return buttons(fill(c.settings.unregistered, { title: e.title }), [menuButton(c)]);
}

export async function myEvents(c: Ctx): Promise<Message> {
  const { results } = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.date, e.time, r.headcount FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.wa_id = ? AND r.status = 'confirmed' AND e.date >= ? ORDER BY e.date LIMIT 10`,
  )
    .bind(c.from, istDay())
    .all<{ id: string; title: string; date: string; time: string; headcount: number }>();
  if (results.length === 0) return buttons(c.settings.my_events_empty, [menuButton(c)]);
  return list(c.settings.my_events, c.settings.events_button, [
    {
      title: c.settings.events_button,
      rows: results.map((r) => ({
        id: `e:${r.id}`,
        title: clip(r.title, 24),
        description: `${shortDate(r.date)}${r.time ? ` · ${r.time}` : ""} · ${people(c, r.headcount)}`,
      })),
    },
  ]);
}
