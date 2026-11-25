# Church WhatsApp Bot v2: build and go-live plan

> **For Claude Code:** this file is the spec. Work through the phases in order.
> - Steps marked **🧑 USER** need the person to do something in a browser or on their phone. Stop, explain the step in plain words, and wait for them to paste back any values.
> - Steps marked **🤖 CLAUDE** are yours.
> - The user may not be a developer. Keep explanations simple. Never print, log or commit secrets.
> - Stop at every **🔴 CHECKPOINT** and confirm with the user before moving on.
>
> v2 replaces `Downloads/CHURCH_BOT_PLAN.md` (v1). v1 kept its content in Google Sheets and assumed every reply was free. v2 moves that content into a dashboard and accounts for Meta's paid replies.

## 1. Goal

Members message the church's WhatsApp number and tap through a menu built from **templates**: Service Timings, Events and Registration, Prayer Request, Give, Location, Contact, Become a Member, Ministries, Verse of the Day, and others. Church admins change everything from a **dashboard** that looks exactly like the church-members admin. They sign in by sending a code to the bot on WhatsApp.

## 2. Cost rules (do not break these)

| Item | Cost |
|---|---|
| Cloudflare Workers, D1, static assets, cron, `workers.dev` | ₹0 on the free plan (100k requests a day, 5M D1 reads and 100k writes a day, 5 GB). D1 refuses queries rather than billing when a limit is hit |
| WhatsApp replies (India, from 1 Oct 2026) | The **first 1,000 replies per number per month are free**. After that each reply costs about ₹0.115 + 18% GST ≈ **₹0.14**. The church adds a card in WhatsApp Manager and pays this overage (the user's decision). The dashboard shows the running total |
| Messages the church starts (templates, reminders, broadcasts) | **Not used.** They cost more, and announcements go on the free WhatsApp Channel |
| Apps Script email relay (optional) | ₹0 (Gmail sends about 100 a day) |
| Phone number | The church's existing **landline** costs nothing extra (Meta verifies it with a voice call). A new SIM needs a recharge |

- **One reply per member action.** Every reply counts toward the 1,000, and `test/bot.test.ts` enforces the limit.
  - "Give" is one image message with the UPI details in its caption.
  - "Location" is one map pin.
  - A photo the bot can't read gets one menu message that starts with the sorry line.
  - A dashboard sign-in gets no reply.
- Marking a message as read and the "typing…" indicator are free.
- No paid Cloudflare features. R2 isn't used because it needs a card.

## 3. Architecture

```
WhatsApp ─▶ Meta Cloud API ─▶ ONE Cloudflare Worker (church-bot.<you>.workers.dev)
                                 ├─ /webhook       the bot             worker/bot.ts, events.ts, forms.ts
                                 ├─ /api/*         dashboard API       worker/api.ts, auth.ts
                                 ├─ /media/*       posters, UPI QR     stored in D1
                                 ├─ everything else: the dashboard     Next.js static export in ./out
                                 ├─ D1 "church-bot" all data           migrations/0001_init.sql
                                 └─ cron 02:00 IST clean-up
```

- **Shared contract:** `lib/shared/`
  - `blocks.ts`: WhatsApp limits and zod schemas
  - `presets.ts`: the template gallery
  - `settings.ts`: every phrase the bot says, all editable
  - `api.ts`: the routes
- **Dashboard:** `app/`, `components/`. The shell, tokens and UI kit are copied unchanged from `church-members`.
- **Tests:** `test/`, run with vitest and `@cloudflare/vitest-plugin` against a real local D1.

### Configuration

| Name | Type | Where it comes from |
|---|---|---|
| `WHATSAPP_TOKEN` | secret | Meta → WhatsApp → API Setup (temporary, 24 h) for testing; a System User token (permanent) in production |
| `APP_SECRET` | secret | Meta App → App settings → Basic → App secret |
| `VERIFY_TOKEN` | secret | A random string Claude generates. The user pastes it into Meta's webhook settings |
| `MAIL_RELAY_URL`, `MAIL_RELAY_KEY` | secret, optional | Phase 4 |
| `PHONE_NUMBER_ID` | secret | Meta → WhatsApp → API Setup (kept out of the public repo) |
| `GRAPH_API_VERSION` | var | The version in the sample curl on API Setup (e.g. `v24.0`) |
| `BOT_NUMBER` | secret | The bot's number, digits only with country code (used for sign-in and share links) |
| `OWNER_PHONE` | secret | The first admin's WhatsApp number, digits only with country code |
| `DRY_RUN` | var | `"true"` only in local `.dev.vars`: logs replies instead of calling Meta |
| `DB` | D1 binding | `npx wrangler d1 create church-bot` (Phase 3) |

Local values go in `.dev.vars`, which is gitignored; `.dev.vars.example` lists the names. Production secrets are set with `npx wrangler secret put NAME` (or `secret bulk`), and the remaining vars go in `wrangler.jsonc`. The repo is public, so phone numbers and Meta IDs are secrets too.

## 4. Information to collect from the user (Phase 0)

- Church name, welcome line, office phone and office hours
- Service timings
- Address, Google Maps pin (latitude and longitude: right-click the pin in Google Maps and copy the numbers)
- UPI ID, payee name exactly as UPI apps show it, and the UPI QR image
- Who should be admins (name and WhatsApp number) and who should be editors. **Editors can't see prayer requests or other private forms.**
- Whether the church has a **landline** that is not on WhatsApp
- Optional: an email address for new prayer requests and forms

Everything else is edited later in the dashboard. Unknown values stay as `[EDIT ME]`.

---

## 5. Phases

### Phase 0: Accounts and test number (🧑 USER, ~20–30 min)
1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up. **No card is needed.**
2. Create a Meta Business portfolio for the church at https://business.facebook.com.
3. Go to https://developers.facebook.com → My Apps → **Create App**. Choose the **WhatsApp** use case (or Other → Business) and link the church's business portfolio.
4. In the app, open **WhatsApp → API Setup**. Meta gives you a free **test number**.
5. Under **"To"**, add **your own WhatsApp number** and verify it with the code Meta sends. You can add up to 5 tester numbers.
6. Click **Send message** to send the `hello_world` template to your phone, and check that it arrives.
7. In **WhatsApp Manager → Billing / Pricing**, check the current India rate and the free monthly allowance (expected: 1,000 free service replies, then about ₹0.115 + GST). Tell Claude if it's different, so the dashboard's Settings → Cost can be updated.
8. Give Claude:
   - Phone number ID
   - WhatsApp Business Account ID
   - Temporary access token
   - API version
   - **App secret** (App settings → Basic → App secret → Show)
   - Your own WhatsApp number (it becomes `OWNER_PHONE`)
9. Answer the questions in section 4.

🔴 **CHECKPOINT:** confirm you have all the values.

### Phase 1: Bot core, locally (🤖 CLAUDE): done in the first build
- `pnpm install` (with `--registry=https://registry.npmjs.org/` if `~/.npmrc` points somewhere else)
- `npx wrangler d1 migrations apply church-bot --local`
- `npx wrangler dev`, then use the simulator in another terminal:
  - `node scripts/simulate.mjs hi`
  - `node scripts/simulate.mjs 1`
  - `node scripts/simulate.mjs --choice b:<id>`
  - `node scripts/simulate.mjs --button r:<eventId>`
  - `node scripts/simulate.mjs --image`
  - `node scripts/simulate.mjs --login 123456`
- Checks: `pnpm test`, `pnpm typecheck` and `pnpm build`.

🔴 **CHECKPOINT:** the user has seen the simulated replies (menu, an event registration, a membership form).

### Phase 2: Dashboard (🤖 CLAUDE): done in the first build
- `pnpm dev` (Next.js on :3000, which proxies `/api` to `wrangler dev` on :8787). Open http://localhost:3000/admin/login.
- To sign in locally:
  1. Note the code on screen.
  2. Run `node scripts/simulate.mjs --login <code>` (it sends from `OWNER_PHONE` in `.dev.vars`).

🔴 **CHECKPOINT:** the user approves the look on desktop and phone widths.

### Phase 3: Deploy and test on your own WhatsApp (🧑 + 🤖)
1. 🧑 Run `npx wrangler login` and approve it in the browser.
2. 🤖 Create the database:
   1. Run `npx wrangler d1 create church-bot` and put the `database_id` it prints in `wrangler.jsonc`.
   2. Run `npx wrangler d1 migrations apply church-bot --remote`.
3. 🤖 Set `GRAPH_API_VERSION` in `wrangler.jsonc` and keep `DRY_RUN` as `"false"`. Anything account-specific stays out of this public repo (step 5).
4. 🤖 Run `pnpm run deploy`, which runs `next build` and then `wrangler deploy`. Note the URL.
5. 🤖 Generate `VERIFY_TOKEN`. Upload it together with `WHATSAPP_TOKEN`, `APP_SECRET`, `PHONE_NUMBER_ID`, `BOT_NUMBER` (the test number for now) and `OWNER_PHONE`, all at once with `npx wrangler secret bulk <file>`. Use a temporary file and delete it afterwards. Then check `<url>/health`.
6. 🧑 In the Meta app, go to **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `<worker URL>/webhook`
   - Verify token: the `VERIFY_TOKEN` (Claude shows it once)
   - Click **Verify and save**, then **Subscribe** to the `messages` field.
7. 🤖 Watch the logs with `npx wrangler tail`.
8. 🧑 Go through the phone checklist below.

**Phone test checklist**
- [ ] "Hi" → the menu appears with a **View options** button
- [ ] Every option works when tapped, and typing `1`–`6` works
- [ ] Each answer arrives as **one** message with a **Menu** button
- [ ] Prayer request → thank-you message. `cancel` works
- [ ] A photo → **one** message: "only text" plus the menu
- [ ] Location opens in Google Maps. UPI ID, payee name and QR code are correct
- [ ] Dashboard: open `<worker URL>/admin`, send the `LOGIN` code to the bot, and you're signed in (the bot does not reply)
- [ ] Edit Service Timings in the dashboard, and the bot shows the change straight away
- [ ] Add an event → register from the phone (with headcount) → it appears in the dashboard → cancel from the phone
- [ ] Add the "Become a Member" template → fill it in → it appears in the Inbox
- [ ] The dashboard's free-replies meter went up by the number of replies you received
- [ ] No message ever arrives that you didn't trigger

**Troubleshooting**

| Symptom | Fix |
|---|---|
| Webhook "Verify and save" fails | The URL must end in `/webhook`, the verify token must match exactly, and the Worker must be deployed (check `/health`) |
| Nothing in `wrangler tail` when you message | Subscribe the `messages` webhook field. Then subscribe the app to the WhatsApp account: `curl -X POST "https://graph.facebook.com/$GRAPH_API_VERSION/$WABA_ID/subscribed_apps" -H "Authorization: Bearer $WHATSAPP_TOKEN"` |
| Error code `190` / "Session has expired" | The temporary token expired after 24 h. Get a new one from API Setup and run `npx wrangler secret put WHATSAPP_TOKEN`, or create the permanent token now (Phase 5, step 4) |
| Error `131030` (recipient not in allowed list) | Add that phone number to the **To** list in API Setup |
| Error `131042` (payment issue) | The free allowance is used up and there's no valid card in WhatsApp Manager |
| `401` in logs for incoming webhooks | `APP_SECRET` is wrong |
| Signed in on the dashboard does nothing | Your number must be in Admins. The first admin is `OWNER_PHONE`, digits only with country code |
| Duplicate replies | Shouldn't happen: the `seen` table de-duplicates. Check that two deployments don't share one webhook |

🔴 **CHECKPOINT:** the user confirms the whole checklist passes.

### Phase 4: Email notifications (optional, 🧑 + 🤖)
1. 🤖 Generate `MAIL_RELAY_KEY`.
2. 🧑 Follow the steps at the top of `apps-script/Code.gs`: paste the file, set `NOTIFY_EMAIL` and `RELAY_KEY`, deploy as a Web app (Execute as **Me**, access **Anyone**), and copy the `/exec` URL.
3. 🤖 Run `npx wrangler secret put MAIL_RELAY_URL` and `npx wrangler secret put MAIL_RELAY_KEY`.
4. 🧑 Send a prayer request from the phone. The email arrives within a minute.

### Phase 5: Go live with the church number (🧑 + 🤖). Only after Phase 3 passes
1. 🧑 Choose the number:
   - **Prefer the church landline**, if it isn't on WhatsApp: Meta verifies it with a voice call, and there's no recharge.
   - Otherwise use a **new SIM** that isn't registered on WhatsApp, and keep it recharged.
2. 🧑 Go to WhatsApp Manager → **Phone numbers → Add phone number**. Enter the display name (the church name) and a category, then verify by SMS or voice. Display name review can take a day or two.
3. 🤖 Register the number with a 6-digit PIN the user chooses. Remind them to save the PIN safely; it's the number's two-step verification PIN.
   ```bash
   curl -X POST "https://graph.facebook.com/$GRAPH_API_VERSION/$NEW_PHONE_NUMBER_ID/register" \
     -H "Authorization: Bearer $WHATSAPP_TOKEN" -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","pin":"<6 digits>"}'
   ```
4. 🧑 Create a **permanent token**:
   1. Business Settings → Users → **System users** → Add (role: Admin).
   2. **Assign assets:** the app (full control) and the WhatsApp account (full control).
   3. **Generate new token:** choose the app, set expiration to **Never**, and tick `whatsapp_business_messaging` and `whatsapp_business_management`.
   4. Give the token to Claude.
5. 🧑 **Add a payment card** in WhatsApp Manager (the user chose to pay for replies after the first 1,000 a month). The dashboard's Usage page shows the monthly count and the estimated cost.
6. 🧑 Switch the app to **Live**:
   1. App settings → Basic → Privacy Policy URL = `<worker URL>/privacy`. Choose a category and add an app icon.
   2. Toggle App Mode to **Live**.
7. 🤖 Update `PHONE_NUMBER_ID`, `BOT_NUMBER` and `WHATSAPP_TOKEN`, run the `subscribed_apps` call, and deploy.
8. 🧑 Re-run the phone checklist from a phone that was **not** on the test list.
9. 🤖 Hand over the share link `https://wa.me/<BOT_NUMBER>?text=Hi`. The dashboard's **Share** page prints a QR poster for the notice board, bulletin and screens.

🔴 **CHECKPOINT:** the live number works from a regular member's phone.

### Phase 6: Handover (🤖 CLAUDE)
Write `README.md` in plain language for volunteers, with screenshots:
- Signing in
- Editing the menu and templates
- Events and registrations
- The Inbox, and its private items
- Roles
- Reading the usage and cost meter
- Changing the token or redeploying
- **What not to do:**
  - Don't send announcements through the bot. Use the WhatsApp Channel.
  - Don't share the token or the PIN.
  - Don't add messages the church starts.

---

## 6. Guardrails for Claude Code
- Never echo, log or commit secrets. Mask values in any output you show.
- Never add anything that makes the bot start a conversation (templates, reminders, broadcasts) unless the user explicitly approves the per-message cost.
- Keep it to one reply per member action, and keep the test that enforces this.
- Never log prayer text, form answers or phone numbers.
- Stay on Cloudflare's free plan.
- Ask before deleting files, databases or deployments.
- If a Meta screen looks different from this plan, describe what you'd expect and ask what's on the user's screen.

## 7. Future: AI (not built)
- **Meta's policy (since 15 Jan 2026):** general-purpose AI chatbots are banned. An assistant that answers only from the church's own content is allowed.
- **Free engine:** Cloudflare **Workers AI** gives 10,000 Neurons a day on the free plan, enough for small models. Some large models have needed the paid plan since July 2026.
- **Where it plugs in:**
  - In the bot, the single "unknown text → menu" branch at the end of `route()` in `worker/bot.ts` becomes "answer from the blocks and events in D1, otherwise show the menu". Settings gets an on/off switch and a daily cap.
  - In the dashboard, "draft or translate this text" and "summarise new Inbox items". These cost no WhatsApp messages.
- Each AI reply on WhatsApp still counts toward the 1,000.

## 8. Skipped on purpose
- Waitlists, reminders and broadcasts (they would be paid messages)
- WhatsApp Flows (would cut a long form to 2 messages; add if form costs grow)
- A public web page and a second language (the user declined both)
- R2, an ORM, a web framework
