// levelOne-Lead 30 15
// levelOne-Follow
// levelTwo-Lead
// levelTwo-Follow
// levelThree-Lead
// levelThree-Follow
// partyPass

exports.up = async (sql) => {
  await sql`
  CREATE TABLE tickets_23(
  id SERIAL PRIMARY KEY, 
  name VARCHAR NOT NULL,
  label VARCHAR NOT NULL,
  capacity int,
  waiting_list int
  )
  `;
};

exports.down = async (sql) => {
  await sql`
	  DROP TABLE tickets_23
	  `;
};
