exports.up = async (sql) => {
  await sql`
	  INSERT INTO tickets_26 (name,label,capacity,waiting_list) VALUES   							
			  ('fullpass_lead', 'Fullpass - Mainly Lead', 180, 10),
			  ('fullpass_follow', 'Fullpass - Mainly Follow', 180, 40),
			  ('fullpass_both', 'Fullpass - Mainly Both', 40, 10)
	  `;
};

exports.down = async (sql) => {
  await sql`
			  DELETE FROM tickets_26
	`;
};
