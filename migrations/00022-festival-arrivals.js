exports.up = async (sql) => {
  await sql`CREATE TABLE festival_arrivals_26 (
    id SERIAL PRIMARY KEY,
    registration_id INTEGER NOT NULL UNIQUE REFERENCES registrations_26(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ
  )`;
  await sql`CREATE INDEX festival_arrivals_pending_idx ON festival_arrivals_26 (id) WHERE checked_in_at IS NULL`;
};

exports.down = async (sql) => {
  await sql`DROP TABLE festival_arrivals_26`;
};
