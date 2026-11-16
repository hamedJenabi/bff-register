import { RegistrationError } from "../reg2026/errors";
import { pushConfiguration } from "./push";
const bearer = (req) =>
  /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || "")?.[1];
const endpoint = (method, action) => async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== method) {
    res.setHeader("Allow", method);
    return res.status(405).end();
  }
  try {
    return res.json(await action(req));
  } catch (error) {
    return res
      .status(error instanceof RegistrationError ? error.status : 500)
      .json({
        error:
          error instanceof RegistrationError
            ? error.message
            : "Festival admin is temporarily unavailable. Please try again.",
      });
  }
};
export const createContentHandlers = (store, attendee) => ({
  manage: {
    login: endpoint("POST", (req) =>
      store.login(req.body?.username, req.body?.password),
    ),
    me: endpoint("GET", (req) => store.overview(bearer(req))),
    logout: endpoint("POST", async (req) => {
      await store.logout(bearer(req));
      return { ok: true };
    }),
    announcement: endpoint("POST", (req) =>
      store.saveAnnouncement(bearer(req), req.body),
    ),
    archive: endpoint("POST", (req) =>
      store.archiveAnnouncement(bearer(req), req.body?.id),
    ),
    push: endpoint("POST", (req) => store.queuePush(bearer(req), req.body)),
    dispatch: endpoint("POST", (req) =>
      store.processPush(bearer(req), req.body?.id),
    ),
  },
  updates: {
    config: endpoint("GET", async (req) => {
      await attendee.resolveSession(bearer(req));
      return { publicKey: pushConfiguration()?.publicKey || null };
    }),
    subscribe: endpoint("POST", async (req) => {
      const access = await attendee.resolveSession(bearer(req));
      return store.subscribe(access.registration_id, req.body);
    }),
    unsubscribe: endpoint("POST", async (req) => {
      const access = await attendee.resolveSession(bearer(req));
      return store.unsubscribe(access.registration_id, req.body?.endpoint);
    }),
  },
});
