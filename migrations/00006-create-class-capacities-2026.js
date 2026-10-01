exports.up = async (sql) => {
  await sql`
    CREATE TABLE class_capacities_26 (
      session_id TEXT NOT NULL,
      pool TEXT NOT NULL CHECK (pool IN ('lead', 'follow', 'total')),
      capacity INTEGER NOT NULL CHECK (capacity >= 0),
      PRIMARY KEY (session_id, pool)
    )
  `;
};

exports.down = async (sql) => {
  await sql`
    DROP TABLE class_capacities_26
  `;
};
