import { LIMITS, clip } from "../lib/shared/blocks";
import { istDay } from "./store";

/**
 * Talking to Meta's WhatsApp Cloud API: the webhook signature check, message
 * builders, and `send`, which also counts every reply for the usage meter.
 * Every reply counts toward Meta's 1,000 free a month in India, so the bot
 * sends exactly one per member action (see test/bot.test.ts).
 */

/** The part of a message after `messaging_product` and `to`. */
export type Message = Record<string, unknown> & { type: string };
export type Button = { id: string; title: string };
export type Row = { id: string; title: string; description?: string };
type Header = { type: "image"; image: { link: string } } | { type: "text"; text: string };

export const text = (body: string): Message => ({
  type: "text",
  text: { body: clip(body, LIMITS.textBody), preview_url: true },
});

export function buttons(body: string, list: Button[], opts: { header?: Header; footer?: string } = {}): Message {
  return {
    type: "interactive",
    interactive: {
      type: "button",
      ...(opts.header ? { header: opts.header } : {}),
      body: { text: clip(body, LIMITS.interactiveBody) },
      ...(opts.footer ? { footer: { text: clip(opts.footer, LIMITS.footer) } } : {}),
      action: {
        buttons: list.slice(0, LIMITS.replyButtons).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: clip(b.title, LIMITS.button) },
        })),
      },
    },
  };
}

export function list(
  body: string,
  button: string,
  sections: { title: string; rows: Row[] }[],
  opts: { footer?: string } = {},
): Message {
  return {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: clip(body, LIMITS.interactiveBody) },
      ...(opts.footer ? { footer: { text: clip(opts.footer, LIMITS.footer) } } : {}),
      action: {
        button: clip(button, LIMITS.button),
        sections: sections.map((s) => ({
          title: clip(s.title, LIMITS.rowTitle),
          rows: s.rows.map((r) => ({
            id: r.id,
            title: clip(r.title, LIMITS.rowTitle),
            ...(r.description ? { description: clip(r.description, LIMITS.rowDescription) } : {}),
          })),
        })),
      },
    },
  };
}

export function ctaUrl(body: string, label: string, url: string, header?: Header): Message {
  return {
    type: "interactive",
    interactive: {
      type: "cta_url",
      ...(header ? { header } : {}),
      body: { text: clip(body, LIMITS.interactiveBody) },
      action: { name: "cta_url", parameters: { display_text: clip(label, LIMITS.button), url } },
    },
  };
}

export const location = (latitude: number, longitude: number, name: string, address: string): Message => ({
  type: "location",
  location: { latitude, longitude, name, address },
});

export const imageHeader = (link: string): Header => ({ type: "image", image: { link } });

const graph = (env: Env, path: string) => `https://graph.facebook.com/${env.GRAPH_API_VERSION}/${path}`;

async function post(env: Env, payload: unknown): Promise<Response> {
  return fetch(graph(env, `${env.PHONE_NUMBER_ID}/messages`), {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Sends one reply and counts it. Never throws; logs Meta's error code (not the content). */
export async function send(env: Env, to: string, message: Message): Promise<boolean> {
  const payload = { messaging_product: "whatsapp", recipient_type: "individual", to, ...message };
  if (env.DRY_RUN === "true") {
    console.log("[dry-run] reply", JSON.stringify(message));
    await countSent(env);
    return true;
  }
  try {
    const res = await post(env, payload);
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
      console.error("whatsapp send failed", res.status, e.error?.code, e.error?.message);
      return false;
    }
    await countSent(env);
    return true;
  } catch (err) {
    console.error("whatsapp send failed", err instanceof Error ? err.name : "unknown");
    return false;
  }
}

/** Blue ticks plus "typing…". Not a message, so it is free and not counted. */
export async function markRead(env: Env, messageId: string): Promise<void> {
  if (env.DRY_RUN === "true") return;
  const res = await post(env, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  }).catch(() => null);
  if (res && !res.ok) console.error("whatsapp mark-read failed", res.status);
}

async function countSent(env: Env) {
  await env.DB.prepare("INSERT INTO usage (day, sent) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET sent = sent + 1")
    .bind(istDay())
    .run();
}

/** X-Hub-Signature-256 must be "sha256=" + hex(HMAC-SHA256(APP_SECRET, raw body)). */
export async function validSignature(secret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = new TextEncoder().encode([...mac].map((b) => b.toString(16).padStart(2, "0")).join(""));
  const given = new TextEncoder().encode(header.slice(7).toLowerCase());
  return expected.byteLength === given.byteLength && crypto.subtle.timingSafeEqual(expected, given);
}
