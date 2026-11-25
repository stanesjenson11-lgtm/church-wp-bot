import type { Block, BlockInput, ChurchEvent, EventInput, Role } from "./blocks";
import type { Settings } from "./settings";

/**
 * The dashboard ⇄ Worker contract. Every route lives under /api and answers
 * JSON. Mutating requests must carry the `x-church: 1` header (a cross-site
 * form cannot set it, so it doubles as CSRF protection with SameSite=Strict).
 * Errors come back as { error: string, issues?: {...} } with a 4xx/5xx status.
 *
 *   GET    /api/me                         → Me                      (401 when signed out)
 *   POST   /api/login/start                → LoginStart              (sets `pending` cookie)
 *   POST   /api/login/poll                 → { status }              (sets `sid` cookie when approved)
 *   POST   /api/logout                     → { ok }
 *   GET    /api/overview                   → Overview
 *   GET    /api/blocks                     → Block[]
 *   POST   /api/blocks          BlockInput → Block
 *   PUT    /api/blocks/:id      BlockInput → Block
 *   DELETE /api/blocks/:id                 → { ok }
 *   POST   /api/blocks/order    { ids }    → { ok }
 *   GET    /api/events                     → ChurchEvent[]           (upcoming first, then past)
 *   POST   /api/events          EventInput → ChurchEvent
 *   PUT    /api/events/:id      EventInput → ChurchEvent
 *   DELETE /api/events/:id                 → { ok }
 *   GET    /api/events/:id/registrations   → Registration[]
 *   PATCH  /api/registrations/:id { checkedIn?, status? } → Registration
 *   GET    /api/submissions?block=:id      → Submission[]            (editors never see private ones)
 *   PATCH  /api/submissions/:id { status } → Submission
 *   DELETE /api/submissions/:id            → { ok }
 *   GET    /api/people                     → Person[]
 *   DELETE /api/people/:waId               → { ok }                  (admin only; deletes everything about them)
 *   GET    /api/settings                   → Settings
 *   PUT    /api/settings  Partial<Settings>→ Settings
 *   GET    /api/admins                     → AdminRow[]              (admin only)
 *   POST   /api/admins          AdminInput → AdminRow                (admin only)
 *   DELETE /api/admins/:phone              → { ok }                  (admin only)
 *   GET    /api/sessions                   → SessionRow[]            (admin only)
 *   DELETE /api/sessions/:id               → { ok }                  (admin only)
 *   GET    /api/usage                      → UsageMonth[]
 *   POST   /api/media   (raw image/jpeg|png body, ≤1.5 MB) → { id, url }
 *   GET    /media/:id                      → the image (public, cached; ids are unguessable)
 */

export type Me = { phone: string; name: string; role: Role; botNumber: string; churchName: string };

export type LoginStart = { code: string; link: string; expiresAt: string; botNumber: string };
export type LoginStatus = "pending" | "approved" | "expired";

export type Usage = {
  /** YYYY-MM */
  month: string;
  sent: number;
  free: number;
  paid: number;
  /** ₹ per paid reply. */
  rate: number;
  /** ₹ so far this month. */
  cost: number;
  /** YYYY-MM-DD, the first of next month. */
  resetsOn: string;
};

export type Overview = {
  usage: Usage;
  /** Replies sent per day, the last 30 days, oldest first; missing days are 0. */
  daily: { day: string; sent: number }[];
  people: { total: number; newThisWeek: number; activeThisWeek: number };
  inbox: { blockId: string; title: string; count: number }[];
  upcoming: ChurchEvent[];
  /** Menu items opened in the last 30 days, most first. */
  taps: { blockId: string; title: string; n: number }[];
  /** ISO time of the last message a member sent, or null. */
  lastMessageAt: string | null;
};

export type Registration = {
  id: string;
  eventId: string;
  waId: string;
  name: string;
  headcount: number;
  answers: Record<string, string>;
  status: "confirmed" | "cancelled";
  checkedIn: boolean;
  createdAt: string;
};

export type Submission = {
  id: string;
  blockId: string;
  blockTitle: string;
  waId: string;
  name: string;
  /** Question label → answer, in question order. */
  answers: { label: string; value: string }[];
  private: boolean;
  status: "new" | "in_progress" | "done";
  createdAt: string;
};

export type Person = {
  waId: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  registrations: number;
  submissions: number;
};

export type AdminRow = { phone: string; name: string; role: Role; createdAt: string };
export type SessionRow = { id: string; phone: string; name: string; userAgent: string; createdAt: string; expiresAt: string; current: boolean };
export type UsageMonth = { month: string; sent: number; paid: number; cost: number };

export type { Block, BlockInput, ChurchEvent, EventInput, Settings };
