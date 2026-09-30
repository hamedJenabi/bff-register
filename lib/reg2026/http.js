import { RegistrationError } from "./errors";
export const publicOrder = (order) => order ? ({
  id: String(order.id), status: order.status, subtotalCents: order.subtotal_cents,
  feeCents: order.fee_cents, totalCents: order.total_cents,
  expiresAt: order.expires_at ? new Date(order.expires_at).toISOString() : null,
}) : null;
export const apiError = (res, error) => {
  if (!(error instanceof RegistrationError)) console.error("Registration service error:", error.message);
  return res.status(error.status || 503).json({
    error: error instanceof RegistrationError ? error.message : "Registration is temporarily unavailable. Please try again.",
    errors: error.errors || {},
  });
};
export const allowMethod = (req, res, method) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === method) return true;
  res.setHeader("Allow", method);
  res.status(405).json({ error: "Method not allowed" });
  return false;
};
