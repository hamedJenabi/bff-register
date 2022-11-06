exports.up = async (sql) => {
  await sql`
	  ALTER TABLE registrations
	  ADD COLUMN lunch VARCHAR (200)
		  `;
};

exports.down = async (sql) => {
  await sql`
	  ALTER TABLE registrations
	  DROP COLUMN lunch
		  `;
};
