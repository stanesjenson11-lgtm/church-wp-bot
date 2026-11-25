"use client";

import type {
  AdminRow,
  Block,
  BlockInput,
  ChurchEvent,
  EventInput,
  LoginStart,
  LoginStatus,
  Me,
  Overview,
  Person,
  Registration,
  SessionRow,
  Settings,
  Submission,
  UsageMonth,
} from "@/lib/shared/api";
import type { AdminInput } from "@/lib/shared/blocks";

/** An API failure, carrying the server's message (safe to show in a toast). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: unknown,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const raw = body instanceof Blob;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(method === "GET" ? {} : { "x-church": "1" }),
      ...(body === undefined ? {} : { "content-type": raw ? body.type : "application/json" }),
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: unknown };
  if (!res.ok) {
    // A signed-out session anywhere sends the person back to the login screen.
    if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/admin/login")) {
      location.assign("/admin/login");
    }
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.issues);
  }
  return data as T;
}

const get = <T,>(p: string) => call<T>("GET", p);
const post = <T,>(p: string, b?: unknown) => call<T>("POST", p, b ?? {});
const put = <T,>(p: string, b: unknown) => call<T>("PUT", p, b);
const patch = <T,>(p: string, b: unknown) => call<T>("PATCH", p, b);
const del = (p: string) => call<{ ok: true }>("DELETE", p);
const q = encodeURIComponent;

export const api = {
  me: () => get<Me>("/me"),
  loginStart: () => post<LoginStart>("/login/start"),
  loginPoll: () => post<{ status: LoginStatus }>("/login/poll"),
  logout: () => post<{ ok: true }>("/logout"),

  overview: () => get<Overview>("/overview"),

  blocks: () => get<Block[]>("/blocks"),
  createBlock: (b: BlockInput) => post<Block>("/blocks", b),
  updateBlock: (id: string, b: BlockInput) => put<Block>(`/blocks/${q(id)}`, b),
  deleteBlock: (id: string) => del(`/blocks/${q(id)}`),
  orderBlocks: (ids: string[]) => post<{ ok: true }>("/blocks/order", { ids }),

  events: () => get<ChurchEvent[]>("/events"),
  createEvent: (e: EventInput) => post<ChurchEvent>("/events", e),
  updateEvent: (id: string, e: EventInput) => put<ChurchEvent>(`/events/${q(id)}`, e),
  deleteEvent: (id: string) => del(`/events/${q(id)}`),
  registrations: (eventId: string) => get<Registration[]>(`/events/${q(eventId)}/registrations`),
  updateRegistration: (id: string, p: { checkedIn?: boolean; status?: Registration["status"] }) =>
    patch<Registration>(`/registrations/${q(id)}`, p),

  submissions: (blockId?: string) => get<Submission[]>(`/submissions${blockId ? `?block=${q(blockId)}` : ""}`),
  updateSubmission: (id: string, status: Submission["status"]) => patch<Submission>(`/submissions/${q(id)}`, { status }),
  deleteSubmission: (id: string) => del(`/submissions/${q(id)}`),

  people: () => get<Person[]>("/people"),
  deletePerson: (waId: string) => del(`/people/${q(waId)}`),

  settings: () => get<Settings>("/settings"),
  saveSettings: (s: Partial<Settings>) => put<Settings>("/settings", s),

  admins: () => get<AdminRow[]>("/admins"),
  addAdmin: (a: AdminInput) => post<AdminRow>("/admins", a),
  removeAdmin: (phone: string) => del(`/admins/${q(phone)}`),
  sessions: () => get<SessionRow[]>("/sessions"),
  revokeSession: (id: string) => del(`/sessions/${q(id)}`),

  usage: () => get<UsageMonth[]>("/usage"),
  uploadMedia: (file: Blob) => call<{ id: string; url: string }>("POST", "/media", file),
};
