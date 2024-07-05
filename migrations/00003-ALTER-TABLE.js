exports.up = async (sql) => {
  await sql`
        ALTER TABLE registrations_23
        ADD COLUMN tshirt VARCHAR(255) DEFAULT '';
    `;
};

exports.down = async (sql) => {
  await sql`
            ALTER TABLE registrations_23
            DROP COLUMN tshirt;
        `;
};
