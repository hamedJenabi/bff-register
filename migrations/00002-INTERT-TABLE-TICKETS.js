exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets (name,capacity,waiting_list) VALUES   									
			  ('one_lead',20,50),
			  ('one_follow',20,50),
			  ('tow_lead',20,50),
			  ('tow_follow',20,50),
			  ('three_lead',40,50),
			  ('three_follow',40,50),
			  ('four_lead',40,50),
			  ('four_follow',40,50),
			  ('five_lead',20,50),
			  ('five_follow',20,50),
			  ('partyPass',200,200)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets
	`;
};
