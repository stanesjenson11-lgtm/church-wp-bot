import { handleApi, serveMedia } from "./api";
import { handleInbound, type Inbound } from "./bot";
import { nowIso } from "./store";
import { validSignature } from "./whatsapp";

/**
 * One Worker for everything: the WhatsApp webhook, the dashboard API, media,
 * and (via the ASSETS binding) the dashboard itself. Static files never reach
 * this code; wrangler.jsonc routes only /api, /webhook, /media and /health here.
 */

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id: string;
          from: string;
          type: string;
          text?: { body?: string };
          interactive?: { list_reply?: { id?: string }; button_reply?: { id?: string } };
          button?: { payload?: string };
        }[];
      };
    }[];
  }[];
};

/** Pulls the member messages out of a webhook body; delivery receipts are ignored. */
export function inboundMessages(body: WebhookBody): Inbound[] {
  const out: Inbound[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const m of value.messages ?? []) {
        const contact = value.contacts?.find((c) => c.wa_id === m.from) ?? value.contacts?.[0];
        out.push({
          id: m.id,
          from: m.from,
          name: (contact?.profile?.name ?? "").slice(0, 100),
          type: m.type,
          text: m.text?.body,
          replyId: m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id ?? m.button?.payload,
        });
      }
    }
  }
  return out;
}

async function webhook(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const p = url.searchParams;
    return p.get("hub.mode") === "subscribe" && env.VERIFY_TOKEN && p.get("hub.verify_token") === env.VERIFY_TOKEN
      ? new Response(p.get("hub.challenge") ?? "", { headers: { "content-type": "text/plain" } })
      : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  if (!(await validSignature(env.APP_SECRET, raw, req.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 });
  }
  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  // Answer Meta at once and work afterwards, so it never retries a slow reply.
  ctx.waitUntil(
    (async () => {
      for (const m of inboundMessages(body)) {
        await handleInbound(env, m, url.origin).catch((err) =>
          console.error("message handling failed", err instanceof Error ? err.message : "unknown"),
        );
      }
    })(),
  );
  return new Response("ok");
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/webhook") return webhook(req, env, ctx);
    if (pathname === "/health") return new Response("ok");
    if (pathname.startsWith("/api/")) return handleApi(req, env);
    if (pathname.startsWith("/media/") && req.method === "GET") return serveMedia(env, pathname.slice(7));
    return env.ASSETS.fetch(req);
  },

  /** Daily at 02:00 IST: forget old dedup ids and anything expired. */
  async scheduled(_controller, env): Promise<void> {
    const now = nowIso();
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM seen WHERE at < ?").bind(twoDaysAgo),
      env.DB.prepare("DELETE FROM chat_state WHERE expires_at < ?").bind(now),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
      env.DB.prepare("DELETE FROM login_requests WHERE expires_at < ?").bind(now),
    ]);
  },
} satisfies ExportedHandler<Env>;
