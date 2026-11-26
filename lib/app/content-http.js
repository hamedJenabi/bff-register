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
const doorEndpoint = (store, method, action) => endpoint(method, async (req) => {
  await store.requireAdmin(bearer(req));
  return action(req.body);
});
export const createContentHandlers = (store, attendee, door, volunteer) => ({
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
    "door-sessions": doorEndpoint(store, "GET", () => door.sessions()),
    "door-verify": doorEndpoint(store, "POST", (body) => door.verify(body || {})),
    "door-roster": doorEndpoint(store, "POST", (body) => door.roster(body?.sessionId)),
    "volunteer-link": endpoint("POST", async (req) => {
      await store.requireAdmin(bearer(req));
      return volunteer.link();
    }),
    "volunteer-replace": endpoint("POST", async (req) => {
      await store.requireAdmin(bearer(req));
      return volunteer.link(true);
    }),
    "volunteer-revoke": endpoint("POST", async (req) => {
      await store.requireAdmin(bearer(req));
      return volunteer.revoke();
    }),
  },
  volunteer: {
    claim: endpoint("POST", (req) => volunteer.claim(req.body?.token)),
    me: endpoint("GET", (req) => volunteer.requireVolunteer(bearer(req))),
    logout: endpoint("POST", (req) => volunteer.logout(bearer(req))),
    "door-sessions": endpoint("GET", async (req) => {
      await volunteer.requireVolunteer(bearer(req));
      return door.sessions();
    }),
    "door-verify": endpoint("POST", async (req) => {
      await volunteer.requireVolunteer(bearer(req));
      return door.verify(req.body || {});
    }),
  },
  openScanner: {
    "door-sessions": endpoint("GET", () => door.sessions()),
    "door-verify": endpoint("POST", (req) => door.verify(req.body || {})),
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
