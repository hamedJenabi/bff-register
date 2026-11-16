exports.up = async (sql) => {
  await sql`CREATE TABLE competition_capacities_26 (
    competition_id TEXT NOT NULL,
    pool TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 0 AND 1000),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_id, pool),
    CHECK ((competition_id = 'solo_battle' AND pool = 'total') OR
      (competition_id IN ('open_mixnmatch','newcomers_mixnmatch','strictly') AND pool IN ('lead','follow')))
  )`;
};

exports.down = async (sql) => {
  await sql`DROP TABLE competition_capacities_26`;
};
