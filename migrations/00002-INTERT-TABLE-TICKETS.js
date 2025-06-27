exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets_23 (name,capacity,waiting_list) VALUES   									
			  ('beg/int_lead',20,50),
			  ('beg/int_follow',20,50),
			  ('int_lead',20,50),
			  ('int_follow',20,50),
			  ('int/adv_lead',20,50),
			  ('int/adv_follow',20,50),
			  ('adv_lead',40,50),
			  ('adv_follow',40,50),
			  ('adv+_lead',20,50),
			  ('adv+_follow',20,50),
			  ('solo',20,50),
			  ('funk_lead',20,50),
			  ('funk_follow',20,50),
			  ('piedmont_lead',20,50),
			  ('piedmont_follow',20,50),
			  ('partyPass',200,200)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets_23
	`;
};
