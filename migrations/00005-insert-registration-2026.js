exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets_26 (name,label,capacity,waiting_list) VALUES   							
			  ('fullpass_lead', 'Full Pass - Mainly Lead', 160, 10),
			  ('fullpass_follow', 'Full Pass - Mainly Follow', 160, 10),
			  ('fullpass_both', 'Full Pass - Both', 50, 10)
    
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets_26
	`;
};
