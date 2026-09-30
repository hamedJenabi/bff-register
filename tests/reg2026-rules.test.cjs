const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateDraft } = require("../lib/reg2026/validation");
const { priceDraft } = require("../lib/reg2026/pricing");
const { schedule } = require("../lib/reg2026/catalog");
const { serializeThemeClass, parseThemeClass } = require("../lib/reg2026/serialization");
const { buildRegistrationPath, verifyIdentitySignature } = require("../lib/reg2026/security");
const empty = () => ({ classes: [], competitions: [], competitionRoles: {}, lunch: [] });

test("signed links preserve plus-addressed email and reject tampering", () => {
  process.env.REG2026_SIGNING_SECRET = "test-secret";
  const url = new URL(buildRegistrationPath({ email: "a+b@example.com", firstname: "A B" }), "https://example.com");
  const identity = url.searchParams.get("user");
  assert.equal(identity, "a+b@example.com+A B");
  assert.ok(verifyIdentitySignature(identity, url.searchParams.get("sig")));
  assert.equal(verifyIdentitySignature(identity + "x", url.searchParams.get("sig")), false);
});
test("Party Pass, malformed drafts, slots and partner roles are enforced", () => {
  const draft = { ...empty(), classes: [{ sessionId: "fri-1330-kantine", role: "lead" }] };
  assert.equal(validateDraft(draft, { ticket: "partyPass" }).valid, false);
  assert.equal(validateDraft(null, { ticket: "fullpass" }).valid, false);
  assert.equal(validateDraft({ ...draft, classes: [{ sessionId: "fri-1330-kantine" }] }, { ticket: "fullpass" }).valid, false);
  draft.classes.push({ sessionId: "fri-1330-studio" });
  assert.match(validateDraft(draft, { ticket: "fullpass" }).errors.classes, /time slot/);
});
test("eight distinct weekend sessions are allowed and serialization round trips", () => {
  const seen = new Set();
  const classes = schedule.filter((s) => !seen.has(s.slotId) && seen.add(s.slotId)).map((s) => ({ sessionId: s.id, ...(s.partnerClass ? { role: "follow" } : {}) }));
  assert.equal(classes.length, 8);
  assert.equal(validateDraft({ ...empty(), classes }, { ticket: "parentPass" }).valid, true);
  assert.deepEqual(parseThemeClass(serializeThemeClass(classes)), classes);
});
test("only new add-ons are charged, no free Full Pass entry, fees use cents", () => {
  const draft = { ...empty(), competitions: ["solo_battle"], lunch: ["saturday"] };
  assert.deepEqual(priceDraft(draft, empty()), { errors: {}, subtotalCents: 2500, feeCents: 61, totalCents: 2561 });
  assert.equal(priceDraft(draft, draft).totalCents, 0);
  assert.ok(priceDraft(empty(), draft).errors.lunch);
});
test("competition roles and invalid choices cannot bypass validation", () => {
  assert.equal(validateDraft({ ...empty(), competitions: ["strictly"] }, { ticket: "fullpass" }).valid, false);
  assert.equal(validateDraft({ ...empty(), lunch: [null] }, { ticket: "fullpass" }).valid, false);
  assert.equal(validateDraft({ ...empty(), classes: [null] }, { ticket: "fullpass" }).valid, false);
});
