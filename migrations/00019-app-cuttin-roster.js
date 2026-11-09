exports.up = async (sql) => {
  await sql`CREATE TABLE app_cuttin_roster_26 (
    registration_id INTEGER PRIMARY KEY REFERENCES registrations_26(id) ON DELETE CASCADE
  )`;
};

exports.down = async (sql) => {
  await sql`DROP TABLE app_cuttin_roster_26`;
};
