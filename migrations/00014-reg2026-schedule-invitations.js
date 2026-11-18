exports.up = async (sql) => {
  await sql`CREATE TABLE registration_schedule_invitations_26 (
    registration_id INTEGER PRIMARY KEY REFERENCES registrations_26(id),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'uncertain')),
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
};

exports.down = async (sql) => {
  await sql`DROP TABLE registration_schedule_invitations_26`;
};
