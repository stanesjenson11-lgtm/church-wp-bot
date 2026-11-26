#!/usr/bin/env node
/**
 * Uploads the bot's secrets from setup.local.json to the deployed Worker,
 * without printing any of them. Safe to run again (e.g. after a new token).
 *
 *   node scripts/push-secrets.mjs
 *
 * VERIFY_TOKEN is generated once and kept in verify-token.local.txt (git-
 * ignored): paste it into Meta → WhatsApp → Configuration → Webhook.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const setup = JSON.parse(readFileSync(new URL("setup.local.json", root), "utf8"));
const digits = (v) => String(v ?? "").replace(/\D/g, "");

const tokenFile = new URL("verify-token.local.txt", root);
if (!existsSync(tokenFile)) writeFileSync(tokenFile, randomBytes(24).toString("base64url") + "\n");

const secrets = {
  WHATSAPP_TOKEN: String(setup.secrets?.WHATSAPP_TOKEN ?? "").trim(),
  APP_SECRET: String(setup.secrets?.APP_SECRET ?? "").trim(),
  VERIFY_TOKEN: readFileSync(tokenFile, "utf8").trim(),
  PHONE_NUMBER_ID: digits(setup.PHONE_NUMBER_ID),
  BOT_NUMBER: digits(setup.BOT_NUMBER),
  OWNER_PHONE: digits(setup.OWNER_PHONE),
};
const missing = Object.entries(secrets).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`setup.local.json is missing: ${missing.join(", ")}`);
  process.exit(1);
}

// A private temp file, deleted straight after the upload.
const dir = mkdtempSync(join(tmpdir(), "church-bot-"));
const file = join(dir, "secrets.json");
try {
  writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
  const wrangler = new URL("node_modules/wrangler/bin/wrangler.js", root);
  execFileSync(process.execPath, [fileURLToPath(wrangler), "secret", "bulk", file], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  console.log(`Uploaded: ${Object.keys(secrets).join(", ")}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
