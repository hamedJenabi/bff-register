exports.up = async (sql) => {
  await sql`ALTER TABLE class_bookings_26 DROP CONSTRAINT class_bookings_26_pool_check`;
  await sql`ALTER TABLE class_bookings_26 ADD CONSTRAINT class_bookings_26_pool_check
    CHECK (pool IN ('lead', 'follow', 'switch', 'total'))`;
};

exports.down = async (sql) => {
  // PostgreSQL rejects this rollback if Switch bookings still need the new role.
  await sql`ALTER TABLE class_bookings_26 DROP CONSTRAINT class_bookings_26_pool_check`;
  await sql`ALTER TABLE class_bookings_26 ADD CONSTRAINT class_bookings_26_pool_check
    CHECK (pool IN ('lead', 'follow', 'total'))`;
};
