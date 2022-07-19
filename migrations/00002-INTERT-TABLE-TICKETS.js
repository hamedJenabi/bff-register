exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets (name,capacity,waiting_list) VALUES   									
			  ('piano_lead',20,50),
			  ('piano_follow',20,50),
			  ('guitar_lead',20,50),
			  ('guitar_follow',20,50),
			  ('trumpet_lead',20,50),
			  ('trumpet_follow',20,50),
			  ('drums_lead',20,50),
			  ('drums_follow',20,50),
			  ('saxophone_lead',20,50),
			  ('saxophone_follow',20,50),
			  ('partyPass',200,200)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets
	`;
};
