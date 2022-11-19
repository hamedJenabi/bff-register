exports.up = async (sql) => {
  await sql`
		ALTER TABLE registrations
		ADD COLUMN to_pay VARCHAR (200)
			`;
};

exports.down = async (sql) => {
  await sql`
		ALTER TABLE registrations
		DROP COLUMN to_pay
			`;
};
