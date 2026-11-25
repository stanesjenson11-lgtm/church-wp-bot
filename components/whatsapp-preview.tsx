"use client";

import { BatteryFull, ChevronLeft, ExternalLink, List, MapPin, Mic, Plus, Signal, Wifi, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { LIMITS, clip, type Block, type ChurchEvent } from "@/lib/shared/blocks";
import type { Settings } from "@/lib/shared/settings";
import { istDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A phone showing a WhatsApp chat with the church bot, drawn the way the bot
 * will actually send each message: one interactive message per answer, with
 * reply buttons, a list button or a link button under the bubble.
 *
 * The colours are WhatsApp's own (inside the phone only), so a volunteer
 * recognises the chat at a glance; everything around the phone stays in the
 * church palette.
 */

/** One message from the bot, as WhatsApp lays it out. */
export type BotMessage = {
  image?: string | null;
  location?: { name: string; address: string };
  body: string;
  footer?: string;
  /** Reply buttons (max 3), shown as rows under the bubble. */
  buttons?: string[];
  /** A list message: one button that opens a sheet of rows. */
  list?: { button: string; section: string; rows: { id: string; title: string; description?: string }[] };
  /** A link button (cta_url). */
  cta?: string;
};

type Line = { from: "member"; text: string } | { from: "bot"; msg: BotMessage };

// ---- Building messages (mirrors the Worker's rules) -----------------------------

const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** "Sun, 7 Dec" from YYYY-MM-DD. */
export const eventDay = (date: string) => WEEKDAY.format(new Date(`${date}T00:00:00Z`));

function dayOfYear(today: string): number {
  const d = new Date(`${today}T00:00:00Z`);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000);
}

export function menuMessage(blocks: Block[], s: Settings): BotMessage {
  const rows = blocks
    .filter((b) => b.enabled)
    .slice(0, LIMITS.listRows)
    .map((b) => ({ id: b.id, title: b.title, description: b.description }));
  return {
    body: s.welcome,
    list: rows.length ? { button: s.menu_button, section: s.menu_section, rows } : undefined,
  };
}

function eventDetail(e: ChurchEvent, s: Settings): BotMessage {
  const when = [eventDay(e.date), e.time].filter(Boolean).join(" · ");
  const body = [`*${e.title}*`, `🗓️ ${when}`, e.venue && `📍 ${e.venue}`, e.details && `\n${e.details}`].filter(Boolean).join("\n");
  return {
    image: e.imageId ? `/media/${e.imageId}` : null,
    body,
    buttons: e.signupOpen ? [s.register, s.menu_label] : [s.menu_label],
  };
}

/** What the bot sends when a member opens `block`. */
export function blockMessage(block: Block, s: Settings, events: ChurchEvent[] = []): BotMessage {
  const menu = [s.menu_label];
  switch (block.type) {
    case "text": {
      const { body, imageId, link } = block.data;
      if (link) return { image: imageId ? `/media/${imageId}` : null, body, cta: link.label };
      // Past the interactive limit it goes as plain text, without the Menu button.
      if (!imageId && body.length > LIMITS.interactiveBody) return { body };
      return { image: imageId ? `/media/${imageId}` : null, body, buttons: menu };
    }
    case "location":
      return { location: { name: block.data.name, address: block.data.address }, body: "" };
    case "events": {
      const today = istDate();
      const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      if (upcoming.length === 0) return { body: block.data.empty, buttons: menu };
      if (upcoming.length === 1) return eventDetail(upcoming[0]!, s);
      return {
        body: block.data.intro,
        list: {
          button: s.events_button,
          section: block.title,
          rows: upcoming.slice(0, LIMITS.listRows).map((e) => ({
            id: e.id,
            title: clip(e.title, LIMITS.rowTitle),
            description: clip([eventDay(e.date), e.time].filter(Boolean).join(" · "), LIMITS.rowDescription),
          })),
        },
      };
    }
    case "form": {
      const { intro, questions } = block.data;
      const q = questions[0]!;
      const step = questions.length > 1 ? `(1/${questions.length}) ` : "";
      const body = `${intro}\n\n${step}${q.label}${q.optional ? `\n\n${s.skip_hint}` : ""}`;
      // Same rules as ask() in worker/forms.ts.
      const base = { body, footer: s.cancel_hint };
      if (q.kind === "yesno") return { ...base, buttons: [s.yes, s.no] };
      if (q.kind === "choice" && q.options) {
        const fitsButtons = q.options.length <= LIMITS.replyButtons && q.options.every((o) => o.length <= LIMITS.button);
        return fitsButtons
          ? { ...base, buttons: q.options }
          : { ...base, list: { button: s.choose, section: s.choose, rows: q.options.map((o) => ({ id: o, title: o })) } };
      }
      // A typed answer goes as plain text, which has no footer: the hint ends the body.
      return { body: `${body}\n\n_${s.cancel_hint}_` };
    }
    case "submenu":
      return {
        body: block.data.intro,
        list: {
          button: block.data.button,
          section: block.title,
          rows: block.data.items.map((i) => ({ id: i.id, title: i.title, description: i.description })),
        },
      };
    case "verse": {
      const { verses } = block.data;
      return { body: verses[dayOfYear(istDate()) % verses.length] ?? "", buttons: menu };
    }
  }
}

// ---- WhatsApp text formatting ----------------------------------------------------

const MARK = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s]+)/g;

/** *bold*, _italic_, ~strike~, ```mono``` and links, as WhatsApp renders them. */
export function WaText({ text }: { text: string }) {
  return <>{format(text)}</>;
}

function format(text: string): React.ReactNode[] {
  return text.split(MARK).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("```") && part.endsWith("```") && part.length > 6) {
      return <code key={i} className="font-mono text-[0.92em]">{part.slice(3, -3)}</code>;
    }
    if (/^https?:\/\//.test(part)) {
      return <span key={i} className="text-(--wa-link) underline-offset-2">{part}</span>;
    }
    const wrap = part[0];
    if (part.length > 2 && part.at(-1) === wrap && part[1] !== " " && part.at(-2) !== " ") {
      const inner = format(part.slice(1, -1));
      if (wrap === "*") return <strong key={i} className="font-semibold">{inner}</strong>;
      if (wrap === "_") return <em key={i}>{inner}</em>;
      if (wrap === "~") return <s key={i}>{inner}</s>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

// ---- The phone --------------------------------------------------------------------

const PALETTE =
  "[--wa-bg:#efeae2] [--wa-in:#ffffff] [--wa-out:#d9fdd3] [--wa-ink:#111b21] [--wa-meta:#667781] [--wa-link:#027eb5] [--wa-bar:#f0f2f5] [--wa-line:rgb(0_0_0/0.08)] " +
  "dark:[--wa-bg:#0b141a] dark:[--wa-in:#202c33] dark:[--wa-out:#005c4b] dark:[--wa-ink:#e9edef] dark:[--wa-meta:#8696a0] dark:[--wa-link:#53bdeb] dark:[--wa-bar:#1f2c34] dark:[--wa-line:rgb(255_255_255/0.08)]";

export function Phone({ churchName, children, sheet }: { churchName: string; children: React.ReactNode; sheet?: React.ReactNode }) {
  return (
    <div
      className={cn(
        PALETTE,
        "mx-auto w-[min(100%,330px)] rounded-[52px] bg-[#1c1c1e] p-[9px] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.45),inset_0_0_0_1px_rgb(255_255_255/0.08)] dark:bg-[#2c2c2e]",
      )}
    >
      <div className="relative flex aspect-[9/19] flex-col overflow-hidden rounded-[43px] bg-(--wa-bg) text-(--wa-ink)">
        {/* Status bar and island: furniture, hidden from screen readers. */}
        <div aria-hidden className="flex h-11 shrink-0 items-center justify-between bg-(--wa-bar) px-7 pt-1 text-[13px] font-semibold">
          <span>9:41</span>
          <span className="absolute top-2.5 left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1">
            <Signal className="size-3.5" strokeWidth={2.5} />
            <Wifi className="size-3.5" strokeWidth={2.5} />
            <BatteryFull className="size-4" strokeWidth={2} />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-b border-(--wa-line) bg-(--wa-bar) px-2 pb-2">
          <ChevronLeft aria-hidden className="size-6 text-(--wa-link)" strokeWidth={2} />
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
            {churchName.trim()[0]?.toUpperCase() ?? "C"}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[14px] font-semibold">{churchName}</span>
            <span className="block text-[11px] text-(--wa-meta)">Business account</span>
          </span>
        </div>

        {children}

        <div aria-hidden className="flex shrink-0 items-center gap-2 bg-(--wa-bar) px-3 pt-2 pb-6">
          <Plus className="size-5 text-(--wa-link)" strokeWidth={2} />
          <span className="h-8 flex-1 rounded-full border border-(--wa-line) bg-(--wa-in)" />
          <span className="grid size-8 place-items-center rounded-full bg-[#25d366] text-white">
            <Mic className="size-4" strokeWidth={2} />
          </span>
        </div>

        {sheet}
      </div>
    </div>
  );
}

/** The chat, scrolled to the newest message. */
function Thread({ lines, onButton, onList }: { lines: Line[]; onButton?: (label: string) => void; onList?: (msg: BotMessage) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <div
      ref={box}
      aria-live="polite"
      className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-2.5 py-3 [background-image:radial-gradient(rgb(0_0_0/0.035)_1px,transparent_1px)] [background-size:14px_14px] [scrollbar-width:none] dark:[background-image:radial-gradient(rgb(255_255_255/0.03)_1px,transparent_1px)]"
    >
      <p className="mx-auto mb-2 w-fit rounded-md bg-(--wa-in) px-2 py-0.5 text-[11px] text-(--wa-meta) shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]">
        Today
      </p>
      {lines.map((line, i) =>
        line.from === "member" ? (
          <div key={i} className="ml-auto w-fit max-w-[80%] rounded-[10px] rounded-tr-[3px] bg-(--wa-out) px-2.5 pt-1.5 pb-1 text-[14px] leading-snug shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]">
            {line.text}
            <span className="float-right mt-1.5 ml-2 text-[10px] text-(--wa-meta)">9:41 ✓✓</span>
          </div>
        ) : (
          <Bubble key={i} msg={line.msg} onButton={onButton} onList={onList} />
        ),
      )}
    </div>
  );
}

function Bubble({ msg, onButton, onList }: { msg: BotMessage; onButton?: (label: string) => void; onList?: (msg: BotMessage) => void }) {
  const row = "flex min-h-9 w-full items-center justify-center gap-1.5 text-[14px] font-medium text-(--wa-link)";
  const press = "transition-[background-color] duration-150 ease-out hover:bg-black/[0.03] dark:hover:bg-white/[0.04]";
  return (
    <div className="w-[85%] space-y-[3px]">
      <div className="overflow-hidden rounded-[10px] rounded-tl-[3px] bg-(--wa-in) shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]">
        {msg.image && (
          // eslint-disable-next-line @next/next/no-img-element -- an uploaded poster served by the Worker
          <img src={msg.image} alt="" className="m-1 mb-0 aspect-[4/3] w-[calc(100%-0.5rem)] rounded-[7px] object-cover" />
        )}
        {msg.location && (
          <div className="m-1 mb-0 overflow-hidden rounded-[7px]">
            <div className="relative grid h-28 place-items-center bg-[#e5e3df] [background-image:linear-gradient(90deg,rgb(255_255_255/0.7)_2px,transparent_2px),linear-gradient(rgb(255_255_255/0.7)_2px,transparent_2px)] [background-size:28px_28px] dark:bg-[#2a3942] dark:[background-image:linear-gradient(90deg,rgb(255_255_255/0.06)_2px,transparent_2px),linear-gradient(rgb(255_255_255/0.06)_2px,transparent_2px)]">
              <MapPin className="size-8 fill-[#ea4335] text-[#a52714]" strokeWidth={1.5} />
            </div>
            <div className="px-2 py-1.5">
              <p className="text-[14px] font-medium">{msg.location.name}</p>
              <p className="text-[12px] text-(--wa-meta)">{msg.location.address}</p>
            </div>
          </div>
        )}
        {msg.body && (
          <p className="px-2.5 pt-1.5 text-[14px] leading-snug break-words whitespace-pre-wrap">
            <WaText text={msg.body} />
          </p>
        )}
        <div className="flex items-end justify-between gap-2 px-2.5 pb-1">
          <span className="text-[12px] text-(--wa-meta)">{msg.footer}</span>
          <span className="text-[10px] text-(--wa-meta)">9:41</span>
        </div>
        {msg.list && (
          <button type="button" onClick={() => onList?.(msg)} className={cn(row, press, "border-t border-(--wa-line)")}>
            <List className="size-4" strokeWidth={2} />
            {msg.list.button}
          </button>
        )}
        {msg.cta && (
          <span className={cn(row, "border-t border-(--wa-line)")}>
            <ExternalLink className="size-4" strokeWidth={2} />
            {msg.cta}
          </span>
        )}
      </div>
      {msg.buttons?.map((b, i) => (
        <button
          key={`${b}-${i}`}
          type="button"
          onClick={() => onButton?.(b)}
          className={cn(row, press, "rounded-[10px] bg-(--wa-in) shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]")}
        >
          {b}
        </button>
      ))}
    </div>
  );
}

/** The sheet a list button opens: the rows a member picks from. */
function ListSheet({ msg, onClose, onPick }: { msg: BotMessage; onClose: () => void; onPick: (id: string, title: string) => void }) {
  const list = msg.list!;
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/30 [animation:wa-fade_160ms_var(--ease-out)]">
      <div className="max-h-[80%] overflow-y-auto rounded-t-[18px] bg-(--wa-in) pb-6 [animation:wa-rise_260ms_var(--ease-out)]">
        <div className="sticky top-0 flex items-center gap-2 border-b border-(--wa-line) bg-(--wa-in) px-3 py-3">
          <button type="button" onClick={onClose} aria-label="Close list" className="grid size-7 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5">
            <X className="size-5 text-(--wa-meta)" strokeWidth={2} />
          </button>
          <span className="flex-1 pr-7 text-center text-[15px] font-semibold">{list.button}</span>
        </div>
        <p className="px-4 pt-3 pb-1 text-[12px] font-medium text-(--wa-meta)">{list.section}</p>
        <ul>
          {list.rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(r.id, r.title)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-[background-color] duration-150 ease-out hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{r.title}</span>
                  {r.description && <span className="block truncate text-[12.5px] text-(--wa-meta)">{r.description}</span>}
                </span>
                <span aria-hidden className="size-5 shrink-0 rounded-full border-2 border-(--wa-meta)/50" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <style>{`@keyframes wa-rise{from{translate:0 100%}}@keyframes wa-fade{from{opacity:0}}`}</style>
    </div>
  );
}

// ---- Ready-made previews ----------------------------------------------------------

/**
 * The whole bot, live: "Hi" brings the menu; tap a row to see that item's
 * reply; "Menu" goes back. Nothing is sent anywhere — it's all in the page.
 */
export function MenuPreview({ blocks, settings, events }: { blocks: Block[]; settings: Settings; events: ChurchEvent[] }) {
  const start = (): Line[] => [{ from: "member", text: "Hi" }, { from: "bot", msg: menuMessage(blocks, settings) }];
  const [lines, setLines] = useState<Line[]>(start);
  const [sheet, setSheet] = useState<BotMessage | null>(null);

  // The menu changed in the editor: start the chat again from "Hi".
  const key = JSON.stringify([blocks, settings]);
  const last = useRef(key);
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    setLines(start());
    setSheet(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for blocks + settings
  }, [key]);

  function say(text: string, reply?: BotMessage) {
    setLines((l): Line[] => [...l, { from: "member" as const, text }, ...(reply ? [{ from: "bot" as const, msg: reply }] : [])].slice(-12));
  }

  function pick(id: string, title: string) {
    setSheet(null);
    const block = blocks.find((b) => b.id === id);
    if (block) return say(title, blockMessage(block, settings, events));
    const item = blocks.flatMap((b) => (b.type === "submenu" ? b.data.items : [])).find((i) => i.id === id);
    say(title, item ? { body: item.body, buttons: [settings.menu_label] } : undefined);
  }

  return (
    <Phone churchName={settings.church_name} sheet={sheet && <ListSheet msg={sheet} onClose={() => setSheet(null)} onPick={pick} />}>
      <Thread
        lines={lines}
        onList={setSheet}
        onButton={(label) => say(label, label === settings.menu_label ? menuMessage(blocks, settings) : undefined)}
      />
    </Phone>
  );
}

/** One item: the member taps it in the menu, and this is the reply. */
export function BlockPreview({ block, settings, events }: { block: Block; settings: Settings; events: ChurchEvent[] }) {
  const [sheet, setSheet] = useState<BotMessage | null>(null);
  const reply = blockMessage(block, settings, events);
  const lines: Line[] = [{ from: "member", text: block.title }, { from: "bot", msg: reply }];
  return (
    <Phone churchName={settings.church_name} sheet={sheet && <ListSheet msg={sheet} onClose={() => setSheet(null)} onPick={() => setSheet(null)} />}>
      <Thread lines={lines} onList={setSheet} />
    </Phone>
  );
}
