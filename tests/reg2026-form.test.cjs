const { test } = require("node:test");
const assert = require("node:assert/strict");
const { registrationFormValues, registrationDraft, registrationFormErrors, validateRegistrationForm } = require("../lib/reg2026/form");
const { priceDraft } = require("../lib/reg2026/pricing");
const empty = () => ({ classes: [], competitions: [], competitionRoles: {}, lunch: [] });
const participant = { ticket: "fullpass" };

test("Reakit values restore a draft and keep UI-only fields out of the request", () => {
  const draft = { ...empty(), classes: [{ sessionId: "fri-1330-kantine", role: "lead" }],
    competitions: ["strictly"], competitionRoles: { strictly: "follow" }, lunch: ["saturday"] };
  const values = registrationFormValues(draft);
  assert.equal(values.compete, "yes");
  assert.equal(values.competitionRoles.open_mixnmatch, "");
  assert.deepEqual(registrationDraft(values), draft);
  assert.deepEqual(validateRegistrationForm(values, participant, empty()), {});
  assert.equal(priceDraft(registrationDraft(values), empty()).totalCents, 2561);
});

test("missing competition roles use nested Reakit errors and recover after a valid edit", () => {
  const values = registrationFormValues({ ...empty(), competitions: ["strictly"] });
  const errors = validateRegistrationForm(values, participant, empty());
  assert.match(errors.competitionRoles.strictly, /lead or follow/);
  assert.match(errors.competitions, /lead or follow/);
  values.competitionRoles.strictly = "lead";
  assert.deepEqual(validateRegistrationForm(values, participant, empty()), {});
  values.competitions = [];
  assert.deepEqual(registrationDraft(values).competitionRoles, {});
});

test("saved paid bookings and roles remain protected in Reakit validation", () => {
  const saved = { ...empty(), competitions: ["strictly"], competitionRoles: { strictly: "lead" }, lunch: ["saturday"] };
  const values = registrationFormValues(saved);
  assert.deepEqual(validateRegistrationForm(values, participant, saved), {});
  values.competitionRoles.strictly = "follow";
  assert.match(validateRegistrationForm(values, participant, saved).competitions, /paid competition role/);
  values.lunch = [];
  assert.match(validateRegistrationForm(values, participant, saved).lunch, /remove paid/);
});

test("empty and partial local drafts initialize all fields and preserve competition intent", () => {
  const values = registrationFormValues(undefined, "yes");
  assert.equal(values.compete, "yes");
  assert.deepEqual(registrationDraft(values), empty());
  assert.deepEqual(validateRegistrationForm(values, { ticket: "partyPass" }, empty()), {});
  assert.deepEqual(registrationFormErrors({ classes: "Full", form: "Unavailable" }),
    { classes: "Full", formError: "Unavailable" });
});
