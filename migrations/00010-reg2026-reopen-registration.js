exports.up = async (sql) => {
  await sql`ALTER TABLE reg2026_orders ADD COLUMN reopened_at TIMESTAMPTZ`;
};

exports.down = async (sql) => {
  await sql`ALTER TABLE reg2026_orders DROP COLUMN reopened_at`;
};
