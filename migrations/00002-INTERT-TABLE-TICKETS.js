exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets_23 (name,label,capacity,waiting_list) VALUES   							
			  ('beg/int_lead', 'Beginner/Intermediate - Mainly Leader', 18, 10),
			  ('beg/int_follow', 'Beginner/Intermediate - Mainly Follow', 18, 10),
			  ('int/adv_lead', 'Intermediate/Advanced - Mainly Leader', 18, 10),
			  ('int/adv_follow', 'Intermediate/Advanced - Mainly Follow', 18, 10),
			  ('adv_lead', 'Advanced - Mainly Leader', 36, 10),
			  ('adv_follow', 'Advanced - Mainly Follow', 36, 10),
			  ('adv+_lead', 'Advanced Plus - Mainly Leader', 18, 10),
			  ('adv+_follow', 'Advanced Plus - Mainly Follow', 18, 10),
			  ('solo_', 'Solo Blues (Intermediate and above)', 30, 10),
			  ('funk_lead', 'Funk - Mainly Leader  (Intermediate/Advanced and above)', 18, 10),
			  ('funk_follow', 'Funk - Mainly Follow  (Intermediate/Advanced and above)', 18, 10),
			  ('piedmont_lead', 'Piedmont - Mainly Leader  (Intermediate/Advanced and above)', 18, 10),
			  ('piedmont_follow', 'Piedmont - Mainly Follow  (Intermediate/Advanced and above)', 18, 10)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets_23
	`;
};
