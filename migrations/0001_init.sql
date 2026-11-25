-- Church bot: everything lives in one D1 database (free plan: 5 GB, 5M row
-- reads and 100k row writes a day). Times are ISO strings in UTC; event dates
-- are YYYY-MM-DD in India time.

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- The menu. `data` is JSON, validated by lib/shared/blocks.ts on every write.
CREATE TABLE blocks (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('text','location','events','form','submenu','verse')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  keywords    TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE events (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  date           TEXT NOT NULL,
  time           TEXT NOT NULL DEFAULT '',
  venue          TEXT NOT NULL DEFAULT '',
  details        TEXT NOT NULL DEFAULT '',
  image_id       TEXT,
  capacity       INTEGER,
  signup_open    INTEGER NOT NULL DEFAULT 1,
  signup_closes  TEXT,
  ask_headcount  INTEGER NOT NULL DEFAULT 1,
  questions      TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL
);
CREATE INDEX events_date ON events (date);

CREATE TABLE registrations (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  wa_id       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  headcount   INTEGER NOT NULL DEFAULT 1,
  answers     TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  checked_in  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (event_id, wa_id)
);
CREATE INDEX registrations_wa ON registrations (wa_id);

-- Form answers (prayer requests, membership, ...). `data` keeps the question
-- labels with the answers, so editing a form later never orphans old rows.
CREATE TABLE submissions (
  id          TEXT PRIMARY KEY,
  block_id    TEXT NOT NULL,
  block_title TEXT NOT NULL,
  wa_id       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL,
  private     INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done')),
  created_at  TEXT NOT NULL
);
CREATE INDEX submissions_block ON submissions (block_id, created_at);
CREATE INDEX submissions_wa ON submissions (wa_id);

CREATE TABLE contacts (
  wa_id      TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  first_seen TEXT NOT NULL,
  last_seen  TEXT NOT NULL
);

-- A member partway through a form or a registration.
CREATE TABLE chat_state (
  wa_id      TEXT PRIMARY KEY,
  state      TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Message ids already handled, so a Meta retry never gets a second (billable) reply.
CREATE TABLE seen (
  msg_id TEXT PRIMARY KEY,
  at     TEXT NOT NULL
);

-- Replies sent per day (India date), for the free-allowance meter.
CREATE TABLE usage (
  day  TEXT PRIMARY KEY,
  sent INTEGER NOT NULL DEFAULT 0
);

-- Menu items opened per day.
CREATE TABLE taps (
  day      TEXT NOT NULL,
  block_id TEXT NOT NULL,
  n        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, block_id)
);

-- Event posters and the UPI QR. Ids are random UUIDs: /media/<id> is public.
CREATE TABLE media (
  id         TEXT PRIMARY KEY,
  mime       TEXT NOT NULL,
  bytes      BLOB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE admins (
  phone      TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin','editor')),
  created_at TEXT NOT NULL
);

-- Only a SHA-256 of the session id is stored; the id itself lives in the cookie.
CREATE TABLE sessions (
  id_hash    TEXT PRIMARY KEY,
  phone      TEXT NOT NULL REFERENCES admins (phone) ON DELETE CASCADE,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_phone ON sessions (phone);

-- A dashboard waiting for "LOGIN <code>" to arrive on WhatsApp.
CREATE TABLE login_requests (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  approved_by TEXT,
  expires_at  TEXT NOT NULL
);
CREATE INDEX login_requests_code ON login_requests (code);
