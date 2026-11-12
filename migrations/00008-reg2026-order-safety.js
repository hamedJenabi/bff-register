exports.up = async (sql) => {
  await sql`ALTER TABLE reg2026_orders DROP CONSTRAINT reg2026_orders_status_check`;
  await sql`ALTER TABLE reg2026_orders ADD CONSTRAINT reg2026_orders_status_check
    CHECK (status IN ('provisional', 'payment_pending', 'confirmed', 'expired', 'payment_failed'))`;
  await sql`ALTER TABLE reg2026_orders ADD COLUMN request_key TEXT`;
  await sql`CREATE UNIQUE INDEX reg2026_orders_request_idx ON reg2026_orders (registration_id, request_key)`;
  await sql`CREATE UNIQUE INDEX reg2026_orders_active_idx ON reg2026_orders (registration_id)
    WHERE status IN ('provisional', 'payment_pending')`;
  await sql`ALTER TABLE registration_email_retries_26 ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'failed'
    CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed'))`;
  await sql`CREATE UNIQUE INDEX reg2026_email_order_idx ON registration_email_retries_26 (order_id, kind)`;
  await sql`CREATE UNIQUE INDEX reg2026_invitation_recipient_idx ON registration_email_retries_26 (registration_id, kind)
    WHERE kind = 'invitation'`;
};
exports.down = async (sql) => {
  await sql`DROP INDEX reg2026_invitation_recipient_idx`;
  await sql`DROP INDEX reg2026_email_order_idx`;
  await sql`ALTER TABLE registration_email_retries_26 DROP COLUMN delivery_status`;
  await sql`DROP INDEX reg2026_orders_active_idx`;
  await sql`DROP INDEX reg2026_orders_request_idx`;
  await sql`ALTER TABLE reg2026_orders DROP COLUMN request_key`;
  await sql`ALTER TABLE reg2026_orders DROP CONSTRAINT reg2026_orders_status_check`;
  await sql`UPDATE reg2026_orders SET status = 'provisional' WHERE status = 'payment_pending'`;
  await sql`ALTER TABLE reg2026_orders ADD CONSTRAINT reg2026_orders_status_check
    CHECK (status IN ('provisional', 'confirmed', 'expired', 'payment_failed'))`;
};
