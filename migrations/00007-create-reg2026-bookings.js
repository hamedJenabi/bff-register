const partnerSessions = [
  "fri-1330-kantine",
  "fri-1330-lot",
  "fri-1330-room-tbc",
  "fri-1515-ankersaal",
  "fri-1515-kantine",
  "fri-1515-studio",
  "fri-1515-room-tbc",
  "sat-1130-ankersaal",
  "sat-1130-superar-3",
  "sat-1130-hilger",
  "sat-1130-lot",
  "sat-1130-social-schule",
  "sat-1130-studio",
  "sat-1415-ankersaal",
  "sat-1415-lot",
  "sat-1415-social-schule",
  "sat-1600-superar-1",
  "sat-1600-superar-2",
  "sat-1600-hilger",
  "sat-1600-lot",
  "sat-1600-social-schule",
  "sat-1600-studio",
  "sun-1130-ankersaal",
  "sun-1130-superar-1",
  "sun-1130-hilger",
  "sun-1130-lot",
  "sun-1130-social-schule",
  "sun-1130-studio",
  "sun-1415-superar-1",
  "sun-1415-lot",
  "sun-1415-social-schule",
  "sun-1600-hilger",
];

const nonPartnerSessions = [
  "fri-1330-ankersaal",
  "fri-1330-studio",
  "fri-1515-lot",
  "sat-1130-superar-1",
  "sat-1130-superar-2",
  "sat-1415-superar-1",
  "sat-1415-superar-2",
  "sat-1415-superar-3",
  "sat-1415-hilger",
  "sat-1415-studio",
  "sat-1600-superar-3",
  "sun-1130-superar-2",
  "sun-1415-ankersaal",
  "sun-1415-superar-2",
  "sun-1415-hilger",
  "sun-1415-studio",
  "sun-1600-ankersaal",
  "sun-1600-superar-1",
  "sun-1600-superar-2",
];

exports.up = async (sql) => {
  await sql`
    CREATE TABLE reg2026_orders (
      id BIGSERIAL PRIMARY KEY,
      registration_id INTEGER NOT NULL REFERENCES registrations_26(id),
      status TEXT NOT NULL CHECK (status IN ('provisional', 'confirmed', 'expired', 'payment_failed')),
      draft JSONB NOT NULL,
      subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
      fee_cents INTEGER NOT NULL CHECK (fee_cents >= 0),
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      stripe_session_id TEXT UNIQUE,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      confirmed_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE class_bookings_26 (
      id BIGSERIAL PRIMARY KEY,
      registration_id INTEGER NOT NULL REFERENCES registrations_26(id),
      order_id BIGINT REFERENCES reg2026_orders(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      pool TEXT NOT NULL CHECK (pool IN ('lead', 'follow', 'total')),
      status TEXT NOT NULL CHECK (status IN ('provisional', 'confirmed')),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (registration_id, order_id, session_id)
    )
  `;

  await sql`
    CREATE INDEX class_bookings_26_availability_idx
    ON class_bookings_26 (session_id, pool, status, expires_at)
  `;

  await sql`
    CREATE TABLE registration_email_retries_26 (
      id BIGSERIAL PRIMARY KEY,
      registration_id INTEGER NOT NULL REFERENCES registrations_26(id),
      order_id BIGINT REFERENCES reg2026_orders(id),
      kind TEXT NOT NULL CHECK (kind IN ('confirmation', 'invitation')),
      payload JSONB NOT NULL,
      last_error TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 1,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  for (const sessionId of partnerSessions) {
    await sql`
      INSERT INTO class_capacities_26 (session_id, pool, capacity)
      VALUES (${sessionId}, 'lead', 20), (${sessionId}, 'follow', 20)
      ON CONFLICT (session_id, pool) DO NOTHING
    `;
  }

  for (const sessionId of nonPartnerSessions) {
    await sql`
      INSERT INTO class_capacities_26 (session_id, pool, capacity)
      VALUES (${sessionId}, 'total', 30)
      ON CONFLICT (session_id, pool) DO NOTHING
    `;
  }
};

exports.down = async (sql) => {
  await sql`DROP TABLE registration_email_retries_26`;
  await sql`DROP TABLE class_bookings_26`;
  await sql`DROP TABLE reg2026_orders`;

  await sql`
    DELETE FROM class_capacities_26
    WHERE session_id = ANY(${[...partnerSessions, ...nonPartnerSessions]})
  `;
};
