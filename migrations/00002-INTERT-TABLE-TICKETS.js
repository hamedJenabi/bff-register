exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets_23 (name,label,capacity,waiting_list) VALUES   							
			  ('beg/int_lead', 'Beginner/Intermediate - Mainly Lead', 18, 10),
			  ('beg/int_follow', 'Beginner/Intermediate - Mainly Follow', 18, 10),
			  ('int_lead', 'Intermediate - Mainly Lead', 18, 10),
			  ('int_follow', 'Intermediate - Mainly Follow', 18, 10),
			  ('int/adv_lead', 'Intermediate/Advanced - Mainly Lead', 18, 10),
			  ('int/adv_follow', 'Intermediate/Advanced - Mainly Follow', 18, 10),
			  ('adv_lead', 'Advanced - Mainly Lead', 36, 10),
			  ('adv_follow', 'Advanced - Mainly Follow', 36, 10),
			  ('adv+_lead', 'Advanced Plus - Mainly Lead', 18, 10),
			  ('adv+_follow', 'Advanced Plus - Mainly Follow', 18, 10),
			  ('funk_lead', 'Funk Blues - Mainly Lead  (Intermediate and higher)', 18, 10),
			  ('funk_follow', 'Funk Blues  - Mainly Follow  (Intermediate and higher)', 18, 10),
			  ('piedmont_lead', 'Piedmont Blues - Mainly Lead  (Intermediate and higher)', 18, 10),
			  ('piedmont_follow', 'Piedmont Blues - Mainly Follow  (Intermediate and higher)', 18, 10),
			  ('solo', 'Solo Blues (Intermediate and higher)', 30, 10)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets_23
	`;
};
