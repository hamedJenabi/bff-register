import { requireAdmin, sameOrigin } from "../admin/session";
import { RegistrationError } from "../reg2026/errors";

const endpoint =
  (method, action, admin = false) =>
  async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method !== method) {
      res.setHeader("Allow", method);
      return res.status(405).end();
    }
    if (admin && !requireAdmin(req, res)) return;
    if (!admin && method === "POST" && !sameOrigin(req)) {
      return res.status(403).json({ error: "Origin is not allowed." });
    }
    try {
      return await action(req, res);
    } catch (error) {
      const known = error instanceof RegistrationError;
      return res.status(known ? error.status : 500).json({
        error: known
          ? error.message
          : "Festival check-in is temporarily unavailable. Please try again.",
      });
    }
  };

export const createArrivalHandlers = (store) => ({
  scan: endpoint("POST", async (req, res) =>
    res.json(await store.scan(req.body?.qr)),
  ),
  dashboard: endpoint(
    "GET",
    async (_req, res) => res.json(await store.dashboard()),
    true,
  ),
  undo: endpoint(
    "POST",
    async (req, res) => {
      const { registrationId } = req.body || {};
      if (
        !Number.isInteger(registrationId) ||
        registrationId <= 0 ||
        registrationId > 2147483647
      ) {
        throw new RegistrationError(422, "Choose a valid registration.");
      }
      await store.undo(registrationId);
      return res.json({ ok: true });
    },
    true,
  ),
  resolve: endpoint(
    "POST",
    async (req, res) => {
      const { id, action } = req.body || {};
      if (
        !Number.isInteger(id) ||
        id <= 0 ||
        id > 2147483647 ||
        !["confirm", "dismiss"].includes(action)
      ) {
        throw new RegistrationError(422, "Choose a valid scan and action.");
      }
      await store[action](id);
      return res.json(await store.dashboard());
    },
    true,
  ),
});
