import { z } from "zod";

/**
 * The shapes the bot and the dashboard share. The Worker validates every write
 * with these schemas, and the dashboard uses the same limits for its counters,
 * so content saved here always fits what WhatsApp will accept.
 */

/** WhatsApp's own limits, from the Cloud API docs. */
export const LIMITS = {
  /** List row title / list section title. */
  rowTitle: 24,
  /** List row description. */
  rowDescription: 72,
  /** The button that opens a list, and each reply button. */
  button: 20,
  /** Body of an interactive message, and an image caption. */
  interactiveBody: 1024,
  /** Body of a plain text message. */
  textBody: 4096,
  /** Rows in one list message (all sections together). */
  listRows: 10,
  /** Reply buttons on one message. */
  replyButtons: 3,
  /** Interactive footer. */
  footer: 60,
} as const;

export const BLOCK_TYPES = ["text", "location", "events", "form", "submenu", "verse"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

const id = z.string().min(1).max(40);
const body = z.string().trim().min(1).max(LIMITS.interactiveBody);

export const QuestionSchema = z
  .object({
    id,
    label: body,
    kind: z.enum(["text", "number", "date", "choice", "yesno"]),
    options: z.array(z.string().trim().min(1).max(LIMITS.rowTitle)).max(LIMITS.listRows).optional(),
    optional: z.boolean().default(false),
  })
  .refine((q) => q.kind !== "choice" || (q.options?.length ?? 0) >= 2, {
    message: "A choice question needs at least 2 options",
    path: ["options"],
  });
export type Question = z.infer<typeof QuestionSchema>;

const TextData = z
  .object({
    body: z.string().trim().min(1).max(LIMITS.textBody),
    imageId: z.string().max(64).nullable().default(null),
    link: z
      .object({ label: z.string().trim().min(1).max(LIMITS.button), url: z.url() })
      .nullable()
      .default(null),
  })
  // An image header or a link button makes it an interactive message, which caps the body.
  .refine((d) => (!d.imageId && !d.link) || d.body.length <= LIMITS.interactiveBody, {
    message: `With an image or a link button the text must be ${LIMITS.interactiveBody} characters or less`,
    path: ["body"],
  });

const LocationData = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const EventsData = z.object({
  intro: body,
  empty: body,
});

const FormData = z.object({
  intro: body,
  questions: z.array(QuestionSchema).min(1).max(10),
  private: z.boolean().default(false),
  thanks: body,
});

const SubmenuData = z.object({
  intro: body,
  button: z.string().trim().min(1).max(LIMITS.button),
  items: z
    .array(
      z.object({
        id,
        title: z.string().trim().min(1).max(LIMITS.rowTitle),
        description: z.string().trim().max(LIMITS.rowDescription).default(""),
        body,
      }),
    )
    .min(1)
    .max(LIMITS.listRows),
});

const VerseData = z.object({
  verses: z.array(body).min(1).max(366),
});

export const BLOCK_DATA = {
  text: TextData,
  location: LocationData,
  events: EventsData,
  form: FormData,
  submenu: SubmenuData,
  verse: VerseData,
} as const;

export type BlockDataMap = { [K in BlockType]: z.infer<(typeof BLOCK_DATA)[K]> };

const BlockBase = z.object({
  title: z.string().trim().min(1).max(LIMITS.rowTitle),
  description: z.string().trim().max(LIMITS.rowDescription).default(""),
  /** Comma-separated words a member can type to open this item. */
  keywords: z.string().trim().max(200).default(""),
  enabled: z.boolean().default(true),
});

/** What the dashboard sends to create or replace a block. */
export const BlockInputSchema = z.discriminatedUnion("type", [
  BlockBase.extend({ type: z.literal("text"), data: TextData }),
  BlockBase.extend({ type: z.literal("location"), data: LocationData }),
  BlockBase.extend({ type: z.literal("events"), data: EventsData }),
  BlockBase.extend({ type: z.literal("form"), data: FormData }),
  BlockBase.extend({ type: z.literal("submenu"), data: SubmenuData }),
  BlockBase.extend({ type: z.literal("verse"), data: VerseData }),
]);
export type BlockInput = z.infer<typeof BlockInputSchema>;
export type Block = BlockInput & { id: string; position: number; updatedAt: string };

export const EventInputSchema = z.object({
  title: z.string().trim().min(1).max(60),
  /** YYYY-MM-DD, in India time. */
  date: z.iso.date(),
  /** Free text such as "6:00 PM". */
  time: z.string().trim().max(40).default(""),
  venue: z.string().trim().max(80).default(""),
  details: z.string().trim().max(800).default(""),
  imageId: z.string().max(64).nullable().default(null),
  /** Total people (sum of headcounts); null for no limit. */
  capacity: z.number().int().min(1).max(100000).nullable().default(null),
  signupOpen: z.boolean().default(true),
  /** Last day to register (inclusive); null closes on the event day. */
  signupCloses: z.iso.date().nullable().default(null),
  askHeadcount: z.boolean().default(true),
  questions: z.array(QuestionSchema).max(5).default([]),
});
export type EventInput = z.infer<typeof EventInputSchema>;
export type ChurchEvent = EventInput & { id: string; registered: number; registrations: number };

export const AdminInputSchema = z.object({
  /** International format without +, e.g. 919876543210 — WhatsApp's wa_id. */
  phone: z.string().regex(/^\d{8,15}$/, "Digits only, with the country code (e.g. 919876543210)"),
  name: z.string().trim().min(1).max(60),
  role: z.enum(["admin", "editor"]),
});
export type AdminInput = z.infer<typeof AdminInputSchema>;
export type Role = AdminInput["role"];

/** "a, B ,c" → ["a","b","c"], matched against lower-cased trimmed text. */
export function keywordList(keywords: string): string[] {
  return keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

/** Cut to `max` characters with an ellipsis, for list rows built from longer text. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
