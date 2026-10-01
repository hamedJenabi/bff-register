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

};

exports.down = async (sql) => {
  await sql`DROP TABLE registration_email_retries_26`;
  await sql`DROP TABLE class_bookings_26`;
  await sql`DROP TABLE reg2026_orders`;

};
