exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets_26 (name,label,capacity,waiting_list) VALUES   							
			  ('beg/int_lead', 'Beginner/Intermediate - Mainly Lead', 20, 10),
			  ('beg/int_follow', 'Beginner/Intermediate - Mainly Follow', 20, 10),
			  ('int_lead', 'Intermediate - Mainly Lead', 22, 10),
			  ('int_follow', 'Intermediate - Mainly Follow', 22, 10),
			  ('adv_lead', 'Advanced - Mainly Lead *', 60, 10),
			  ('adv_follow', 'Advanced - Mainly Follow *', 60, 10),
			  ('funk_lead', 'Funk Blues Track - Mainly Lead **', 20, 10),
			  ('funk_follow', 'Funk Blues Track  - Mainly Follow **', 20, 10),
			  ('piedmont_lead', 'Piedmont Blues Track - Mainly Lead **', 20, 10),
			  ('piedmont_follow', 'Piedmont Blues Track - Mainly Follow **', 20, 10),
			  ('latin_lead', 'Latin Blues Track - Mainly Lead **', 20, 10),
			  ('latin_follow', 'Latin Blues Track - Mainly Follow **', 20, 10),
			  ('solo', 'Solo Blues Track **', 30, 10)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets_26
	`;
};
