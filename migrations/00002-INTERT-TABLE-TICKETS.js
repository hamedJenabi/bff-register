exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets (name,capacity,waiting_list) VALUES   									
			  ('piano_lead',20,20),
			  ('piano_follow',20,20),
			  ('guitar_lead',20,20),
			  ('guitar_follow',20,20),
			  ('trumpet_lead',20,20),
			  ('trumpet_follow',20,20),
			  ('drums_lead',20,20),
			  ('drums_follow',20,20),
			  ('saxophone_lead',20,20),
			  ('saxophone_follow',20,20),
			  ('partyPass',200,200)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets
	`;
};
