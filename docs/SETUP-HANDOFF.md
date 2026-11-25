# Handoff: set up Cloudflare + Meta WhatsApp for testing

> **For Claude Desktop.** You are helping the owner of this project set up their accounts in the browser, so the church WhatsApp bot can be tested on the owner's own phone. The code is already written and tested; it lives at https://github.com/stanesjenson11-lgtm/church-wp-bot (folder on the owner's computer: `C:\Users\stane\Downloads\side Projects\church wp bot`).
>
> **Claude Code (in the terminal) does the deploy.** Your part is the browser work in **Part A**, **Part B** and **Part D**. Stop at each **🛑 HAND BACK** and tell the owner to switch to Claude Code.

## Rules for this session

1. **The owner signs in.** They type all passwords, OTPs, 2-step codes and phone verification codes themselves. Don't type them for them.
2. **Secrets never go in chat.** The **App secret**, the **access token** and the **verify token** are secrets. Show the owner where each one is on screen, and let **them** copy it into `setup.local.json` (or, for the verify token, into Meta's field). Don't read them back, repeat them, or paste them anywhere yourself.
3. **Don't spend money or go live:**
   - Don't add a payment method.
   - Don't upgrade any plan or enable Cloudflare R2.
   - Don't switch the Meta app to **Live**.
   - Don't create WhatsApp message templates.
   - Don't buy a phone number.

   All of that comes later, at go-live.
4. **If a screen looks different from these steps** (Meta changes its dashboard often), describe what you expected and ask the owner what they see. Don't guess.
5. **Plain words.** The owner may not be a developer.

## What we're collecting

Everything goes into **`setup.local.json`** in the project folder. The file is ignored by git, so it is never committed. To create it, copy `setup.example.json` to `setup.local.json`.

| Key in `setup.local.json` | What it is | Secret? | Where (Part) |
|---|---|---|---|
| `WORKERS_SUBDOMAIN` | Your `*.workers.dev` name | no | A2 |
| `PHONE_NUMBER_ID` | Meta's ID for the test number (a long number) | no | B4 |
| `WABA_ID` | WhatsApp Business Account ID | no | B4 |
| `BOT_NUMBER` | The **test number** itself, digits only with country code (e.g. `15551234567`) | no | B4 |
| `OWNER_PHONE` | **Your** WhatsApp number, digits only with country code (e.g. `919876543210`) | no | B5 |
| `GRAPH_API_VERSION` | e.g. `v24.0`, from the sample request on the API Setup page | no | B4 |
| `secrets.APP_SECRET` | App secret | **yes** | B7 |
| `secrets.WHATSAPP_TOKEN` | Access token (permanent one preferred) | **yes** | B8 |

---

## Part A: Cloudflare (about 5 minutes)

1. Go to https://dash.cloudflare.com/sign-up, or log in if the owner already has an account. The owner types the email, password and email-verification code. **No card is needed**, and the free plan is all this project uses.
2. In the left menu, open **Compute (Workers) → Workers & Pages** (older layout: **Workers & Pages**).
   - If Cloudflare asks to **choose a `workers.dev` subdomain**, pick something short, such as the church name (`gracechurch`). Write it as `WORKERS_SUBDOMAIN`.
   - If it already has one, it's shown on the Workers overview page (`<name>.workers.dev`).
3. Don't create a Worker or a database by hand. Claude Code does that from the terminal in Part C.

## Part B: Meta WhatsApp test number (about 20 minutes)

1. **Business portfolio:** at https://business.facebook.com, the owner signs in with their Facebook account and creates a **business portfolio** for the church (church name, owner's name, email). If one already exists, use it.
2. **App:** at https://developers.facebook.com, choose **Get started** if this is a new developer account (the owner verifies their phone or email), then **My Apps → Create App**.
   - Use case: **Connect with customers through WhatsApp** (it may just say "WhatsApp"). If asked for an app type instead, choose **Business**.
   - App name: `Church Bot` (anything works).
   - Business portfolio: the one from step 1.
   - Create the app. The owner may need to re-enter their Facebook password.
3. In the app's left menu, open **WhatsApp → API Setup** (sometimes **WhatsApp → Getting started / Quickstart**). Meta creates a free **test phone number** for you.
4. On that page, write down:
   - **Phone number ID** → `PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID** → `WABA_ID`
   - The **"From"** test number (e.g. `+1 555 123 4567`) → `BOT_NUMBER`, digits only: `15551234567`
   - In the **sample request** (curl), the version in the URL (e.g. `https://graph.facebook.com/v24.0/...`) → `GRAPH_API_VERSION`
5. **"To" field → Manage phone number list → Add phone number.** Enter the **owner's own WhatsApp number**. Meta sends a code to that WhatsApp, and **the owner types the code**. Write the number as `OWNER_PHONE`, digits only with country code. Up to 5 numbers can be added; you can add a family member's later.
6. Click **Send message** to send the `hello_world` test message. Check that it arrives on the owner's phone.
7. **App secret** (secret): left menu **App settings → Basic → App secret → Show**. The owner may need their password. **The owner** copies it into `setup.local.json` as `secrets.APP_SECRET`.
8. **Access token** (secret). Two options:
   - **Recommended, permanent:** at https://business.facebook.com go to **Settings → Users → System users → Add**.
     1. Name it `church-bot` with role **Admin**.
     2. Select it, then **Assign assets**: pick the **App** `Church Bot` with full control, and the **WhatsApp account** with full control.
     3. Click **Generate token**. App: `Church Bot`. Expiration: **Never**. Permissions: tick **`whatsapp_business_messaging`** and **`whatsapp_business_management`**.
     4. **The owner** copies the token into `setup.local.json` as `secrets.WHATSAPP_TOKEN`. Meta shows it only once.
   - **Quick fallback:** the **Temporary access token** on the API Setup page. It works for **24 hours only**, and then the bot stops replying until it's replaced.
9. **Check pricing, but don't add a card.** In **WhatsApp Manager** (https://business.facebook.com/wa/manage/) → Overview or Billing, note what it says about free messages and the India rate. Expected: **1,000 free service replies a month per number**, then about **₹0.115 + GST** each. Tell the owner if it's different. A test number doesn't need a payment method.
10. **Don't** set up the webhook yet. It needs the bot's web address, which Part C creates.

🛑 **HAND BACK:** tell the owner: *"Meta and Cloudflare are ready. `setup.local.json` is filled in. Go to Claude Code and say: **setup.local.json is ready, deploy it**."*

---

## Part C: deploy (Claude Code does this, not you)

For context only. Claude Code will:
1. Have the owner run `! npx wrangler login` and approve it in the browser.
2. Create the D1 database `church-bot`, apply `migrations/`, and put the database ID and the non-secret values in `wrangler.jsonc`.
3. Generate a random `VERIFY_TOKEN`. Upload `WHATSAPP_TOKEN`, `APP_SECRET` and `VERIFY_TOKEN` as Worker secrets with `wrangler secret bulk`, so nothing is printed.
4. Deploy with `pnpm run deploy`, giving `https://church-bot.<WORKERS_SUBDOMAIN>.workers.dev`, and check `/health`.
5. Give the owner the **Callback URL**, and save the **verify token** to `verify-token.local.txt` (git-ignored) for the owner to copy.

---

## Part D: connect Meta to the bot (Claude Desktop, about 3 minutes)

1. In the Meta app, open **WhatsApp → Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL:** `https://church-bot.<WORKERS_SUBDOMAIN>.workers.dev/webhook` (Claude Code gives the exact URL)
   - **Verify token:** **the owner** pastes it from `verify-token.local.txt`.
   - Click **Verify and save**. If it fails: the URL must end in `/webhook`, the token must match exactly, and `https://church-bot.<WORKERS_SUBDOMAIN>.workers.dev/health` should show `ok`.
3. Under **Webhook fields**, find **`messages`** and click **Subscribe**. Leave the other fields off.

🛑 **HAND BACK:** tell the owner to tell Claude Code: *"Webhook verified and `messages` subscribed."* Claude Code then links the app to the WhatsApp account (the `subscribed_apps` call) and watches the live logs.

---

## Part E: test from the owner's phone

On WhatsApp, the owner messages the **test number** and checks:

- [ ] "Hi" → the menu appears with a **View options** button
- [ ] Each option works when tapped, and typing `1`–`6` works
- [ ] Each answer arrives as **one** message with a **Menu** button
- [ ] Prayer request → thank-you message. `cancel` works
- [ ] A photo → **one** message: "only text" plus the menu
- [ ] Location opens in Google Maps
- [ ] **Dashboard:** on a computer, open `https://church-bot.<WORKERS_SUBDOMAIN>.workers.dev/admin`. It shows a code. Send `LOGIN <code>` to the test number from the owner's phone, and the dashboard signs in. The bot doesn't reply to this on purpose.
- [ ] Change Service Timings in the dashboard, and the bot shows the new text straight away
- [ ] Add an event in the dashboard → register from the phone → it appears in the dashboard → cancel from the phone
- [ ] The dashboard's "Free replies used" number went up
- [ ] No message ever arrives that the owner didn't trigger

Only phone numbers in the **"To"** list (step B5) can talk to a test number. Real church members come at go-live (Phase 5 in `CHURCH_BOT_PLAN.md`), with the church's own number.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Verify and save" fails | The URL must end in `/webhook`, the verify token must match exactly, and `/health` must show `ok` |
| Bot doesn't answer at all | `messages` must be subscribed (D3), and Claude Code must have run `subscribed_apps` |
| Logs show error `190` | The token expired (that happens to the 24-hour token). Make the permanent one (B8) and give it to Claude Code |
| Logs show error `131030` | That phone isn't in the **"To"** list (B5) |
| Logs show `401` on webhooks | The App secret is wrong. Copy it again (B7) |
| Dashboard login does nothing | Use the phone number in `OWNER_PHONE`, and send exactly `LOGIN 123456` to the **test number** |
