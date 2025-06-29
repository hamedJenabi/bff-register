exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets_23 (name,label,capacity,waiting_list) VALUES   							
			  ('beg/int_lead', 'Beginner/Intermediate - Mainly Leader', 18, 10),
			  ('beg/int_follow', 'Beginner/Intermediate - Mainly Follow', 18, 10),
			  ('int_lead', 'Intermediate - Mainly Leader', 18, 10),
			  ('int_follow', 'Intermediate - Mainly Follow', 18, 10),
			  ('adv_lead', 'Advanced - Mainly Leader', 36, 10),
			  ('adv_follow', 'Advanced - Mainly Follow', 36, 10),
			  ('adv+_lead', 'Advanced Plus - Mainly Leader', 18, 10),
			  ('adv+_follow', 'Advanced Plus - Mainly Follow', 18, 10),
			  ('solo_', 'Solo Blues (Intermediate and above)', 30, 10),
			  ('funk_lead', 'Funk Blues - Mainly Leader  (Intermediate and above)', 18, 10),
			  ('funk_follow', 'Funk Blues  - Mainly Follow  (Intermediate and above)', 18, 10),
			  ('piedmont_lead', 'Piedmont Blues - Mainly Leader  (Intermediate and above)', 18, 10),
			  ('piedmont_follow', 'Piedmont Blues - Mainly Follow  (Intermediate and above)', 18, 10)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets_23
	`;
};
