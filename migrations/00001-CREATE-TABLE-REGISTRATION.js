exports.up = async (sql) => {
  await sql`
	CREATE TABLE registrations(
			id SERIAL PRIMARY KEY, 
			date VARCHAR(255) NOT NULL,
			status VARCHAR(255) NOT NULL,
			role VARCHAR NOT NULL,
			ticket VARCHAR NOT NULL,
			firstname VARCHAR (100) NOT NULL, 
			lastname VARCHAR (100) NOT NULL, 
			email VARCHAR NOT NULL, 
			country VARCHAR NOT NULL, 
			level VARCHAR,
			theme_class VARCHAR,
			lunch VARCHAR (200),
			competition VARCHAR,
			competition_role VARCHAR(100),
			competitions VARCHAR,
			price VARCHAR (100),
			to_pay VARCHAR (100),
			terms boolean
	)
	`;
};

exports.down = async (sql) => {
  await sql`
		DROP TABLE registrations
		`;
};
