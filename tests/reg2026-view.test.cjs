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
  const values = { REG2026_SIGNING_SECRET: "registration-view-test-secret", REG2026_ENABLED: "false", REG2026_CLOSES_AT: "2026-11-21T00:00:00+01:00" };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const now = Date.now;
  Object.assign(process.env, values);
  Date.now = () => Date.parse("2026-11-22T12:00:00+01:00");
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
  completed: true, classesLocked: true, open: true, order: null,
};
const render = (data, access = {}) => renderToStaticMarkup(
  React.createElement(RouterContext.Provider, { value: { replace: async () => {} } },
    React.createElement(Registration, { initial: data, access, loadError: null })),
);

test("links show confirmed classes without a class picker and still offer competition registration", () => {
  for (const intern of [undefined, "true"]) {
    const html = render(initial, { intern });
    assert.match(html, /Your registered classes/);
    assert.ok(html.includes(schedule[0].title));
    assert.ok(!html.includes(schedule.find((entry) => entry.title !== schedule[0].title).title));
    assert.match(html, /Dance role:.*Switch/);
    assert.match(html, /Competition registration/);
    assert.match(html, /Open MixMatch/);
    assert.match(html, /Saturday lunch/);
    assert.doesNotMatch(html, /Your class schedule|Edit festival choices/);
  }
});

test("first-time links show the class picker and competition form, or payment recovery while checkout is pending", () => {
  const empty = { classes: [], competitions: [], competitionRoles: {}, lunch: [] };
  const first = { ...initial, completed: false, classesLocked: false, choices: empty };
  const html = render(first);
  assert.match(html, /Your class schedule/);
  assert.match(html, /Competition registration/);
  assert.match(html, /Review and submit/);
  const provisional = render({ ...first, open: false, order: { id: "2", status: "provisional" }, pendingDraft: choices });
  assert.match(provisional, /Open secure checkout/);
  assert.match(provisional, /Cancel pending checkout/);
  assert.doesNotMatch(provisional, /Your class schedule|Open MixMatch|<form\b/);
  const party = render({ ...first, participant: { ...first.participant, ticket: "partyPass" } });
  assert.match(party, /Competition registration/);
  assert.doesNotMatch(party, /Your registered classes|Your class schedule/);
});

test("SSR and refresh offer new competitions and agree on the class lock after the old cutoff", async () => withEnv(async () => {
  const participant = { ...initial.participant, email: "ada@example.com", theme_class: serializeThemeClass(choices.classes),
    competitions: "open_mixnmatch", open_mixnmatch_role: "follow", lunch: "saturday" };
  const firstTime = { ...participant, theme_class: null };
  const user = `${participant.email}+${participant.firstname}`;
  let current = participant;
  const store = {
    findParticipants: async () => [current], activeOrder: async () => null,
    completedOrder: async () => null,
    schedule: async () => schedule, availability: async () => initial.availability,
    internalRegistrationEnabled: async () => true,
  };
  await withStore(store, async () => {
    const load = require("../pages/api/reg2026/index").default;
    for (current of [participant, firstTime]) {
      for (const intern of [undefined, "true"]) {
        const query = { user, sig: signIdentity(user), intern };
        const res = response();
        await load({ method: "GET", query }, res);
        assert.equal(res.code, 200);
        const ssr = await getServerSideProps({ query, res: response() });
        assert.equal(ssr.props.loadError, null);
        for (const data of [res.body, ssr.props.initial]) {
          assert.equal(data.open, true);
          assert.equal(data.classesLocked, current === participant);
          assert.deepEqual(data.choices.classes, current === participant ? choices.classes : []);
          assert.deepEqual(data.choices.competitions, choices.competitions);
          assert.deepEqual(data.choices.lunch, choices.lunch);
        }
      }
    }
  });
}));
