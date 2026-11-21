exports.up = async (sql) => {
  await sql`CREATE TABLE reg2026_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    intern_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`INSERT INTO reg2026_settings (id) VALUES (1)`;
};

exports.down = async (sql) => {
  await sql`DROP TABLE reg2026_settings`;
};
