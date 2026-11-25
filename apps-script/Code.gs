/**
 * OPTIONAL email relay for the church bot (free: Gmail allows about 100
 * emails a day). When someone sends a prayer request or fills in a form, the
 * bot posts here and this script emails the church office.
 *
 * Set up (about 5 minutes, on the church's Google account):
 *   1. Go to https://script.google.com → New project. Paste this whole file.
 *   2. Change NOTIFY_EMAIL and RELAY_KEY below. RELAY_KEY must match the
 *      MAIL_RELAY_KEY secret given to the Worker (Claude generates it).
 *   3. Deploy → New deployment → Web app → Execute as: Me →
 *      Who has access: Anyone → Deploy. Allow the permissions it asks for
 *      ("Google hasn't verified this app" is normal for your own script:
 *      Advanced → Go to project → Allow).
 *   4. Copy the URL ending in /exec. That's MAIL_RELAY_URL.
 * After editing this file later: Deploy → Manage deployments → Edit →
 * Version: New version → Deploy (the URL stays the same).
 */
const NOTIFY_EMAIL = 'office@example.org'; // [EDIT ME] who gets the emails (comma-separate several)
const RELAY_KEY = 'PASTE-THE-MAIL_RELAY_KEY-HERE'; // [EDIT ME]

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ error: 'bad json' });
  }
  if (!data || data.key !== RELAY_KEY) return reply({ error: 'unauthorized' });

  const subject = String(data.subject || 'New message from the church bot').slice(0, 200);
  const body = String(data.body || '').slice(0, 20000);
  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  return reply({ ok: true });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
