const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { RouterContext } = require("next/dist/shared/lib/router-context");
const babel = require("next/dist/compiled/babel/core");
const { schedule } = require("../lib/reg2026/catalog");
const { signIdentity } = require("../lib/reg2026/security");
const { serializeThemeClass } = require("../lib/reg2026/serialization");

// Render the actual registration page with Next's JSX transform and CSS stubs.
const originalJs = require.extensions[".js"];
require.extensions[".js"] = (module, filename) => {
  if (filename !== path.resolve(__dirname, "../pages/reg2026.js") &&
      !filename.startsWith(path.resolve(__dirname, "../components/Reg2026") + path.sep)) {
    return originalJs(module, filename);
  }
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, babelrc: false, configFile: false,
    presets: [["next/babel", { "preset-env": { targets: { node: "current" }, modules: "commonjs" } }]],
  });
  module._compile(code, filename);
};
require.extensions[".scss"] = (module) => { module.exports = {}; };
const { default: Registration, getServerSideProps } = require("../pages/reg2026");
require.extensions[".js"] = originalJs;

const response = () => ({
  code: 200, headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(value) { this.code = value; return this; },
  json(value) { this.body = value; return this; },
});
const withEnv = async (action) => {
  const values = { REG2026_SIGNING_SECRET: "view-only-test-secret", REG2026_ENABLED: "true", REG2026_CLOSES_AT: "2099-01-01T00:00:00Z" };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const now = Date.now;
  Object.assign(process.env, values);
  // Verify normal links stay read-only even while editing is otherwise open.
  Date.now = () => Date.parse("2026-11-20T12:00:00+01:00");
  try { await action(); } finally {
    Date.now = now;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
};
const withStore = async (store, action) => {
  const dbPath = require.resolve("../db/reg2026");
  const previous = require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { registrationStore: store } };
  const endpoints = ["index", "submit", "checkout", "cancel"].map((name) => require.resolve(`../pages/api/reg2026/${name}`));
  endpoints.forEach((file) => delete require.cache[file]);
  try { await action(); } finally {
    if (previous) require.cache[dbPath] = previous; else delete require.cache[dbPath];
    endpoints.forEach((file) => delete require.cache[file]);
  }
};
const choices = {
  classes: [{ sessionId: schedule[0].id, role: "switch" }],
  competitions: ["open_mixnmatch"], competitionRoles: { open_mixnmatch: "follow" }, lunch: ["saturday"],
};
const initial = {
  participant: { id: 1, firstname: "Ada", lastname: "Dancer", ticket: "fullpass" },
  choices, schedule, availability: { classes: {}, competitions: {} },
  completed: true, open: true, edit: { version: "test-version" }, order: null,
};
const render = (data, access = {}) => renderToStaticMarkup(
  React.createElement(RouterContext.Provider, { value: { replace: async () => {} } },
    React.createElement(Registration, { initial: data, access, loadError: null })),
);

test("normal registration links show only saved choices, including roles, without any form controls", () => {
  for (const intern of [undefined, "false", "1", "TRUE", true, ["true"]]) {
    const html = render(initial, { intern });
    assert.match(html, /Ada/);
    assert.ok(html.includes(schedule[0].title));
    assert.ok(!html.includes(schedule.find((entry) => entry.title !== schedule[0].title).title));
    assert.match(html, /Dance role:.*Switch/);
    assert.match(html, /Open MixMatch/);
    assert.match(html, /Dance role:.*Follow/);
    assert.match(html, /Saturday lunch/);
    assert.doesNotMatch(html, /Sunday lunch|Solo Battle|Review and submit|Edit festival choices/);
    assert.doesNotMatch(html, /<(form|input|select|button)\b/);
  }
});

test("uncompleted and pending normal registrations show saved choices without exposing the pending draft", () => {
  const empty = { classes: [], competitions: [], competitionRoles: {}, lunch: [] };
  for (const status of [undefined, "provisional", "payment_pending", "expired", "payment_failed"]) {
    const html = render({ ...initial, completed: false, choices: empty,
      order: status ? { id: "2", status } : null, pendingDraft: choices });
    assert.match(html, /No classes registered/);
    assert.match(html, /No competitions registered/);
    assert.match(html, /No lunch booked/);
    assert.doesNotMatch(html, /Open MixMatch|Saturday lunch|<(form|input|select|button)\b/);
  }
  const party = render({ ...initial, participant: { ...initial.participant, ticket: "partyPass" }, choices: empty });
  assert.doesNotMatch(party, /Your registered classes/);
});

test("intern=true retains the registration form and eligible edit action", () => {
  const html = render({ ...initial, completed: false, edit: null }, { intern: "true" });
  assert.match(html, /<form\b/);
  assert.match(html, /Review and submit/);
  assert.match(render(initial, { intern: "true" }), /Edit festival choices/);
});

test("normal links cannot write through submission, checkout, or cancellation endpoints", async () => withEnv(async () => {
  const participant = { ...initial.participant, email: "ada@example.com" };
  const user = `${participant.email}+${participant.firstname}`;
  // Any store call beyond authentication would fail this test.
  await withStore({ findParticipants: async () => [participant] }, async () => {
    for (const name of ["submit", "checkout", "cancel"]) {
      const handler = require(`../pages/api/reg2026/${name}`).default;
      for (const intern of [undefined, "false", "1", "TRUE", true, ["true"]]) {
        const res = response();
        await handler({ method: "POST", body: { user, sig: signIdentity(user), intern, draft: choices, requestKey: "view-only-attempt-01" } }, res);
        assert.equal(res.code, 403);
        assert.match(res.body.error, /view-only/);
      }
    }
  });
}));

test("SSR and refresh both withhold edit permission from normal links while preserving saved choices", async () => withEnv(async () => {
  const participant = { ...initial.participant, email: "ada@example.com", theme_class: serializeThemeClass(choices.classes),
    competitions: "open_mixnmatch", open_mixnmatch_role: "follow", lunch: "saturday" };
  const user = `${participant.email}+${participant.firstname}`;
  const store = {
    findParticipants: async () => [participant], activeOrder: async () => null, completedOrder: async () => ({ id: 1, status: "confirmed" }),
    schedule: async () => schedule, availability: async () => initial.availability,
    internalRegistrationEnabled: async () => true, claimConfirmation: async () => ({ status: "sent" }),
  };
  await withStore(store, async () => {
    const load = require("../pages/api/reg2026/index").default;
    for (const intern of [undefined, "false", "true"]) {
      const query = { user, sig: signIdentity(user), intern };
      const res = response();
      await load({ method: "GET", query }, res);
      assert.equal(res.code, 200);
      const ssr = await getServerSideProps({ query, res: response() });
      assert.equal(ssr.props.loadError, null);
      for (const data of [res.body, ssr.props.initial]) {
        assert.equal(data.open, intern === "true");
        assert.equal(!!data.edit, intern === "true");
        assert.deepEqual(data.choices.classes, choices.classes);
        assert.deepEqual(data.choices.competitions, choices.competitions);
        assert.deepEqual(data.choices.lunch, choices.lunch);
      }
    }
  });
}));
