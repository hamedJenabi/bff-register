exports.up = async (sql) => {
  await sql`CREATE TABLE festival_admin_sessions_26 (
    token_hash TEXT PRIMARY KEY, credential_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE festival_admin_attempts_26 (
    id INTEGER PRIMARY KEY CHECK (id = 1), attempts INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE festival_announcements_26 (
    id UUID PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
    expires_on DATE, archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE festival_push_subscriptions_26 (
    id UUID PRIMARY KEY, registration_id INTEGER NOT NULL REFERENCES registrations_26(id),
    endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX festival_push_registration_idx ON festival_push_subscriptions_26(registration_id)`;
  await sql`CREATE TABLE festival_push_messages_26 (
    id UUID PRIMARY KEY, request_id UUID NOT NULL UNIQUE,
    title TEXT NOT NULL, description TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE festival_push_deliveries_26 (
    message_id UUID NOT NULL REFERENCES festival_push_messages_26(id),
    subscription_id UUID NOT NULL, status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','sending','sent','failed','expired','unknown')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (message_id, subscription_id)
  )`;
};
exports.down = async (sql) => {
  for (const table of [
    "festival_push_deliveries_26",
    "festival_push_messages_26",
    "festival_push_subscriptions_26",
    "festival_announcements_26",
    "festival_admin_attempts_26",
    "festival_admin_sessions_26",
  ])
    await sql`DROP TABLE ${sql(table)}`;
};
