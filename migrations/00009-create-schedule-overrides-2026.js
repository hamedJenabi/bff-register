exports.up = async (sql) => {
  await sql`CREATE TABLE schedule_overrides_26 (
    session_id TEXT PRIMARY KEY,
    data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
};

exports.down = async (sql) => {
  await sql`DROP TABLE schedule_overrides_26`;
};
