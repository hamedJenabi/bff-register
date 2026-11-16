exports.up = async (sql) => {
  await sql`CREATE TABLE festival_volunteer_access_26 (
    id UUID PRIMARY KEY,
    singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton),
    nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    claim_count INTEGER NOT NULL DEFAULT 0,
    claim_window TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE festival_volunteer_sessions_26 (
    token_hash TEXT PRIMARY KEY,
    access_id UUID NOT NULL REFERENCES festival_volunteer_access_26(id) ON DELETE CASCADE,
    credential_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX festival_volunteer_sessions_access_idx ON festival_volunteer_sessions_26(access_id)`;
};

exports.down = async (sql) => {
  await sql`DROP TABLE festival_volunteer_sessions_26`;
  await sql`DROP TABLE festival_volunteer_access_26`;
};
