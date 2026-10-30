import { requireAdmin } from "../admin/session";
import { RegistrationError } from "../reg2026/errors";

const bearer = (req) =>
  /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || "")?.[1];
const participantId = (value) => {
  const id = Number(value);
  if (
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    throw new RegistrationError(422, "A valid participant ID is required.");
  }
  return id;
};
const endpoint = (method, action) => async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== method) {
    res.setHeader("Allow", method);
    return res.status(405).end();
  }
  try {
    return await action(req, res);
  } catch (error) {
    const status = error instanceof RegistrationError ? error.status : 500;
    return res.status(status).json({
      error:
        status === 500
          ? "The festival app is temporarily unavailable. Please try again."
          : error.message,
    });
  }
};

export const createAppHandlers = (store, contentStore) => ({
  claim: endpoint("POST", async (req, res) =>
    res.json(await store.claim(req.body?.token)),
  ),
  me: endpoint("GET", async (req, res) => {
    const snapshot = await store.snapshot(bearer(req));
    return res.json({
      ...snapshot,
      announcements: contentStore
        ? await contentStore.publicAnnouncements()
        : [],
    });
  }),
  logout: endpoint("POST", async (req, res) => {
    await store.logout(bearer(req));
    return res.json({ ok: true });
  }),
  link: endpoint("POST", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { url, access } = await store.issueAccess(
      participantId(req.body?.id),
    );
    return res.json({
      appAccessUrl: url,
      expiresAt: new Date(access.expires_at).toISOString(),
    });
  }),
  revoke: endpoint("POST", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await store.revoke(participantId(req.body?.id));
    return res.json({ ok: true });
  }),
});
