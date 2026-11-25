import { LIMITS, type Question } from "../lib/shared/blocks";
import type { Settings } from "../lib/shared/settings";
import { buttons, list, text, type Message } from "./whatsapp";

/**
 * Asking one question and reading the answer. Used by form blocks (prayer,
 * membership, …) and by an event's extra questions. Choice and yes/no answers
 * come back as reply ids `a:<index>`, `a:yes` and `a:no`.
 */

export type Input = { text?: string; replyId?: string };
export type Parsed = { ok: true; value: string } | { ok: false; error: string };

/** One message: optional lead-in (intro, or the error), "(2/6)", the question. */
export function ask(s: Settings, q: Question, index: number, total: number, lead = ""): Message {
  const head = lead ? `${lead}\n\n` : "";
  const counter = total > 1 ? `(${index + 1}/${total}) ` : "";
  const body = `${head}${counter}${q.label}${q.optional ? `\n\n${s.skip_hint}` : ""}`;

  if (q.kind === "yesno") {
    return buttons(body, [{ id: "a:yes", title: s.yes }, { id: "a:no", title: s.no }], { footer: s.cancel_hint });
  }
  if (q.kind === "choice" && q.options) {
    const fitsButtons = q.options.length <= LIMITS.replyButtons && q.options.every((o) => o.length <= LIMITS.button);
    return fitsButtons
      ? buttons(body, q.options.map((o, i) => ({ id: `a:${i}`, title: o })), { footer: s.cancel_hint })
      : list(body, s.choose, [{ title: s.choose, rows: q.options.map((o, i) => ({ id: `a:${i}`, title: o })) }], {
          footer: s.cancel_hint,
        });
  }
  // Typed answers: a plain text message has no footer, so the hint goes in the body.
  return text(`${body}\n\n_${s.cancel_hint}_`);
}

export function parse(s: Settings, q: Question, input: Input): Parsed {
  const typed = input.text?.trim() ?? "";
  const lower = typed.toLowerCase();
  if (q.optional && lower === "skip") return { ok: true, value: "" };

  switch (q.kind) {
    case "yesno": {
      if (input.replyId === "a:yes" || [s.yes.toLowerCase(), "yes", "y"].includes(lower)) return { ok: true, value: s.yes };
      if (input.replyId === "a:no" || [s.no.toLowerCase(), "no", "n"].includes(lower)) return { ok: true, value: s.no };
      return { ok: false, error: s.invalid_choice };
    }
    case "choice": {
      const options = q.options ?? [];
      const byId = input.replyId?.startsWith("a:") ? Number(input.replyId.slice(2)) : NaN;
      const byNumber = /^\d{1,2}$/.test(lower) ? Number(lower) - 1 : NaN;
      const index = [byId, byNumber, options.findIndex((o) => o.toLowerCase() === lower)].find(
        (i) => Number.isInteger(i) && i >= 0 && i < options.length,
      );
      return index === undefined ? { ok: false, error: s.invalid_choice } : { ok: true, value: options[index]! };
    }
    case "number":
      return /^\d{1,6}$/.test(typed) ? { ok: true, value: String(Number(typed)) } : { ok: false, error: s.invalid_number };
    case "date": {
      const m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/.exec(typed);
      if (!m) return { ok: false, error: s.invalid_date };
      const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const date = new Date(Date.UTC(y, mo - 1, d));
      const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
      return real && y >= 1900 && y <= 2100
        ? { ok: true, value: `${String(d).padStart(2, "0")}-${String(mo).padStart(2, "0")}-${y}` }
        : { ok: false, error: s.invalid_date };
    }
    default:
      return typed ? { ok: true, value: typed.slice(0, 3000) } : { ok: false, error: s.text_only };
  }
}
