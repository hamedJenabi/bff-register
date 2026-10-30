exports.up = async (sql) => {
  await sql`CREATE TABLE attendee_access_26 (
    id UUID PRIMARY KEY,
    registration_id INTEGER NOT NULL UNIQUE REFERENCES registrations_26(id),
    nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE attendee_sessions_26 (
    token_hash TEXT PRIMARY KEY,
    access_id UUID NOT NULL REFERENCES attendee_access_26(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX attendee_sessions_26_access_idx ON attendee_sessions_26(access_id)`;
};

exports.down = async (sql) => {
  await sql`DROP TABLE attendee_sessions_26`;
  await sql`DROP TABLE attendee_access_26`;
};
