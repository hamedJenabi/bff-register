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
test("five classes across the festival are allowed; six and eight are rejected", () => {
  const seen = new Set();
  const sessions = schedule.filter((session) => !seen.has(session.slotId) && seen.add(session.slotId))
    .map((session) => ({ sessionId: session.id, ...(session.partnerClass ? { role: "follow" } : {}) }));
  assert.equal(sessions.length, 8);
  const classes = sessions.slice(0, 5);
  for (const ticket of ["fullpass", "parentPass"]) {
    assert.equal(validateDraft(empty(), { ticket }).valid, true);
    assert.equal(validateDraft({ ...empty(), classes }, { ticket }).valid, true);
    for (const count of [6, 8]) {
      const result = validateDraft({ ...empty(), classes: sessions.slice(0, count) }, { ticket });
      assert.equal(result.valid, false);
      assert.match(result.errors.classes, /5 classes in total/);
    }
  }
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
