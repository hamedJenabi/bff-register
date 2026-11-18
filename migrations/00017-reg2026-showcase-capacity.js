exports.up = async (sql) => {
  await sql`ALTER TABLE competition_capacities_26
    DROP CONSTRAINT competition_capacities_26_check,
    ADD CONSTRAINT competition_capacities_26_check CHECK (
      (competition_id IN ('solo_battle','fever_showcase') AND pool = 'total') OR
      (competition_id IN ('open_mixnmatch','newcomers_mixnmatch','strictly') AND pool IN ('lead','follow'))
    )`;
};

exports.down = async (sql) => {
  await sql`DELETE FROM competition_capacities_26 WHERE competition_id = 'fever_showcase'`;
  await sql`ALTER TABLE competition_capacities_26
    DROP CONSTRAINT competition_capacities_26_check,
    ADD CONSTRAINT competition_capacities_26_check CHECK (
      (competition_id = 'solo_battle' AND pool = 'total') OR
      (competition_id IN ('open_mixnmatch','newcomers_mixnmatch','strictly') AND pool IN ('lead','follow'))
    )`;
};
