const test = require("node:test");
const assert = require("node:assert/strict");
const { registrationsCsv } = require("../lib/admin/registrations-csv");
const { serializeThemeClass } = require("../lib/reg2026/serialization");

test("registration CSV keeps classes, lunch, and competitions in their own columns", () => {
  const themeClass = serializeThemeClass([
    { sessionId: "fri-1330-kantine", role: "lead" },
    { sessionId: "sat-1130-superar-1" },
  ]);
  const csv = registrationsCsv([{
    id: 7,
    status: "confirmed",
    parent_partner: 'Jo, "JJ"\r\nJunior',
    firstname: "Zoë",
    country: "Austria",
    theme_class: themeClass,
    lunch: "saturday,sunday",
    competitions: "solo_battle,strictly",
    to_pay: "15",
    donation: 0,
    terms: false,
  }]);

  assert.equal(csv, registrationsCsv([]) +
    '"7","","confirmed","","","Jo, ""JJ""\r\nJunior","Zoë","","","Austria","",' +
    `"${themeClass.replaceAll('"', '""')}","saturday,sunday","","","","","","solo_battle,strictly","","15","0","false"\r\n`);
});

test("registration CSV keeps the same headers for an empty list", () => {
  assert.equal(registrationsCsv([]),
    '\uFEFF"id","date","status","role","ticket","parent_partner","firstname","lastname",' +
    '"email","country","level","theme_class","lunch","tshirt","competition","strictly_role",' +
    '"newcomers_mixnmatch_role","open_mixnmatch_role","competitions","price","to_pay","donation","terms"\r\n');
});

test("registration CSV escapes spreadsheet formulas and preserves signed amounts", () => {
  const csv = registrationsCsv([{ firstname: '= "Ada"', lastname: " +Dancer", to_pay: "-12.5" }]);
  assert.ok(csv.includes(`"'= ""Ada""","' +Dancer"`));
  assert.ok(csv.includes(',"-12.5",'));
});
