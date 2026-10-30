exports.up = async (sql) => {
  await sql`
    CREATE TABLE schedule_publications_26 (
      id BIGSERIAL PRIMARY KEY,
      spreadsheet_id TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      sessions JSONB NOT NULL CHECK (jsonb_typeof(sessions) = 'array' AND jsonb_array_length(sessions) > 0),
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
};

exports.down = async (sql) => {
  await sql`DROP TABLE schedule_publications_26`;
};
