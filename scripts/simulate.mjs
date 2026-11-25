#!/usr/bin/env node
/**
 * Sends a signed, realistic WhatsApp webhook to the local Worker, as if a
 * member had messaged the bot. Run `npx wrangler dev` first (with DRY_RUN=true
 * in .dev.vars); the bot's reply is printed in that terminal.
 *
 *   node scripts/simulate.mjs hi
 *   node scripts/simulate.mjs --choice b:<blockId>     tap a list row
 *   node scripts/simulate.mjs --button r:<eventId>     tap a reply button
 *   node scripts/simulate.mjs --image                  send a photo
 *   node scripts/simulate.mjs --login 123456           "LOGIN 123456" from OWNER_PHONE
 *   node scripts/simulate.mjs --from 919800000000 hi   as another member
 *   --url http://localhost:8787/webhook                somewhere else
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const vars = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const args = process.argv.slice(2);
const take = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const [, value] = args.splice(i, 2);
  return value ?? "";
};
const takeFlag = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};

const url = take("--url") ?? "http://localhost:8787/webhook";
const login = take("--login");
const from = take("--from") ?? (login ? vars.OWNER_PHONE : "919811111111");
const choice = take("--choice");
const button = take("--button");
const image = takeFlag("--image");
const text = login ? `LOGIN ${login}` : args.join(" ") || "hi";

if (!vars.APP_SECRET) throw new Error("APP_SECRET is missing from .dev.vars");

const message = image
  ? { type: "image", image: { id: "sim-media", mime_type: "image/jpeg" } }
  : choice
    ? { type: "interactive", interactive: { type: "list_reply", list_reply: { id: choice, title: choice } } }
    : button
      ? { type: "interactive", interactive: { type: "button_reply", button_reply: { id: button, title: button } } }
      : { type: "text", text: { body: text } };

const body = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "SIMULATED_WABA",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: vars.BOT_NUMBER ?? "", phone_number_id: vars.PHONE_NUMBER_ID ?? "" },
            contacts: [{ wa_id: from, profile: { name: "Simulated Member" } }],
            messages: [{ id: `wamid.sim.${Date.now()}`, from, timestamp: String(Math.floor(Date.now() / 1000)), ...message }],
          },
        },
      ],
    },
  ],
});
const signature = `sha256=${createHmac("sha256", vars.APP_SECRET).update(body).digest("hex")}`;

const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": signature }, body });
console.log(`${res.status} ${await res.text()}  (${from}: ${choice ?? button ?? (image ? "[photo]" : text)})`);
console.log("The bot's reply is in the `wrangler dev` terminal ([dry-run] reply …).");
