const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash, createVerify, generateKeyPairSync } = require("node:crypto");
const { SHEET_COLUMNS, parseScheduleRows } = require("../lib/reg2026/sheet-schema");
const { RegistrationError } = require("../lib/reg2026/errors");
const { fetchScheduleSheet, getScheduleAdminState, syncScheduleFromSheet } = require("../lib/reg2026/google-sheets");
const { setAdminSession } = require("../lib/admin/session");

const spreadsheetId = "1testScheduleWorkbook_01234567890123456789";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKey = keys.privateKey.export({ type: "pkcs8", format: "pem" });
let credentialIndex = 0;
const credentials = () => ({ email: `schedule-test-${++credentialIndex}@example.iam.gserviceaccount.com`, privateKey });
const response = (body, ok = true) => ({ ok, text: async () => JSON.stringify(body) });
const metadata = (sheetName = "APP_SCHEDULE", rowCount = 1000, columnCount = 26) => ({ sheets: [
  { properties: { title: "Unrelated tab", gridProperties: { rowCount: 5000, columnCount: 5 } } },
  { properties: { title: sheetName, gridProperties: { rowCount, columnCount } } },
] });
const isMetadata = (url) => url.startsWith("https://sheets.googleapis.com/") && !url.includes("/values/");
const values = () => [
  SHEET_COLUMNS,
  ["sheet-session-b", "Friday", "", "13:30", "14:45", "Kantine", "Partner class", "Teacher Two", "Description B", "All levels", "partner", "20", "15", "", "TRUE"],
  ["sheet-session-a", "Friday", "", "13:30", "14:45", "Ankersaal", "  Solo class  ", "Teacher One", "Description A", "II–III", "solo", "", "", "30", true],
];
const source = (sessions) => ({ spreadsheetId, sheetName: "APP_SCHEDULE", sessions, sourceHash: createHash("sha256").update(JSON.stringify(sessions)).digest("hex") });
const withEnvironment = async (updates, action) => {
  const previous = Object.fromEntries(Object.keys(updates).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await action(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("Google schedule reads use a verified read-only service-account assertion and one bounded authenticated range", async () => {
  const auth = credentials();
  const calls = [];
  const sheetName = "Teacher's Schedule";
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return response({ access_token: "test-access-token", expires_in: 3600 });
    if (isMetadata(url)) return response(metadata(sheetName));
    return response({ values: values() });
  };
  const snapshot = await fetchScheduleSheet({ spreadsheetId, sheetName, credentials: auth, fetchImpl });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(calls[0].options.method, "POST");
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const [header, payload, signature] = form.get("assertion").split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  assert.equal(claims.iss, auth.email);
  assert.equal(claims.scope, "https://www.googleapis.com/auth/spreadsheets.readonly");
  assert.equal(claims.aud, calls[0].url);
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(Math.abs(Math.floor(Date.now() / 1000) - claims.iat) < 5);
  assert.ok(createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(keys.publicKey, Buffer.from(signature, "base64url")));
  const metadataUrl = new URL(calls[1].url);
  assert.equal(metadataUrl.origin, "https://sheets.googleapis.com");
  assert.equal(metadataUrl.pathname, `/v4/spreadsheets/${spreadsheetId}`);
  assert.equal(metadataUrl.searchParams.get("fields"), "sheets(properties(title,gridProperties(rowCount,columnCount)))");
  const readUrl = new URL(calls[2].url);
  assert.equal(readUrl.origin, "https://sheets.googleapis.com");
  assert.equal(decodeURIComponent(readUrl.pathname), `/v4/spreadsheets/${spreadsheetId}/values/'Teacher''s Schedule'!A1:Z1000`);
  assert.equal(readUrl.searchParams.get("valueRenderOption"), "FORMATTED_VALUE");
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-access-token");
  assert.equal(calls[2].options.headers.Authorization, "Bearer test-access-token");
  assert.ok(calls.every(({ options }) => options.signal instanceof AbortSignal));
  assert.equal(snapshot.spreadsheetId, spreadsheetId);
  assert.equal(snapshot.sheetName, sheetName);
  assert.deepEqual(snapshot.sessions, parseScheduleRows(values()));
  assert.equal(snapshot.sessions[0].title, "Solo class");
  assert.equal(snapshot.sourceHash, createHash("sha256").update(JSON.stringify(snapshot.sessions)).digest("hex"));
});

test("normalization makes row ordering and numeric display types hash-stable and reuses the read token", async () => {
  const auth = credentials();
  let authenticationCalls = 0;
  let metadataReads = 0;
  let reads = 0;
  const fetchImpl = async (url) => {
    if (url === "https://oauth2.googleapis.com/token") {
      authenticationCalls += 1;
      return response({ access_token: "cached-test-token", expires_in: 3600 });
    }
    if (isMetadata(url)) {
      metadataReads += 1;
      return response(metadata());
    }
    reads += 1;
    const rows = values();
    if (reads === 2) {
      rows.reverse();
      rows.pop();
      rows.unshift(SHEET_COLUMNS);
      rows[1][6] = "Solo class";
      rows[1][13] = 30;
    }
    return response({ values: rows });
  };
  const first = await fetchScheduleSheet({ spreadsheetId, credentials: auth, fetchImpl });
  const second = await fetchScheduleSheet({ spreadsheetId, credentials: auth, fetchImpl });
  assert.equal(authenticationCalls, 1);
  assert.equal(metadataReads, 2);
  assert.equal(reads, 2);
  assert.equal(first.sourceHash, second.sourceHash);
  assert.deepEqual(first.sessions, second.sessions);
});

test("credential, network and Google response failures never reveal raw provider diagnostics", async () => {
  const sensitive = "TEST_SECRET_private_key_or_provider_body";
  const cases = [
    { phase: "auth", result: () => response({ error: sensitive }, false) },
    { phase: "auth", result: () => ({ ok: true, text: async () => sensitive }) },
    { phase: "auth", result: () => { throw new Error(sensitive); } },
    { phase: "auth", result: () => response({ access_token: sensitive }) },
    { phase: "metadata", result: () => response({ error: sensitive }, false) },
    { phase: "metadata", result: () => ({ ok: true, text: async () => sensitive }) },
    { phase: "metadata", result: () => { throw new Error(sensitive); } },
    { phase: "read", result: () => response({ error: sensitive }, false) },
    { phase: "read", result: () => ({ ok: true, text: async () => sensitive }) },
    { phase: "read", result: () => { throw new Error(sensitive); } },
  ];
  for (const item of cases) {
    const fetchImpl = async (url) => {
      if (url === "https://oauth2.googleapis.com/token" && item.phase !== "auth") return response({ access_token: "safe-test-token", expires_in: 3600 });
      if (isMetadata(url) && item.phase === "read") return response(metadata());
      return item.result();
    };
    await assert.rejects(fetchScheduleSheet({ spreadsheetId, credentials: credentials(), fetchImpl }), (error) => {
      assert.equal(error.status, 503);
      assert.ok(!JSON.stringify({ message: error.message, errors: error.errors }).includes(sensitive));
      return true;
    });
  }
  let requested = false;
  const fetchImpl = async () => { requested = true; throw new Error("must not make a request"); };
  for (const auth of [{ email: "", privateKey: "" }, { email: "fake@example.com", privateKey: sensitive }]) {
    await assert.rejects(fetchScheduleSheet({ spreadsheetId, credentials: auth, fetchImpl }), (error) => error.status === 503 && !error.message.includes(sensitive));
  }
  assert.equal(requested, false);
});

test("incomplete sheet rows and oversized responses fail before any snapshot is returned", async () => {
  const incomplete = values();
  incomplete[1][10] = "";
  const fetchImpl = async (url) => url === "https://oauth2.googleapis.com/token"
    ? response({ access_token: "safe-test-token", expires_in: 3600 }) : isMetadata(url) ? response(metadata()) : response({ values: incomplete });
  await assert.rejects(fetchScheduleSheet({ spreadsheetId, credentials: credentials(), fetchImpl }), (error) => {
    assert.equal(error.status, 422);
    assert.ok(error.errors["row 2: format"]);
    return true;
  });
  const oversized = async (url) => url === "https://oauth2.googleapis.com/token"
    ? response({ access_token: "safe-test-token", expires_in: 3600 }) : isMetadata(url) ? response(metadata()) : { ok: true, text: async () => " ".repeat(4 * 1024 * 1024 + 1) };
  await assert.rejects(fetchScheduleSheet({ spreadsheetId, credentials: credentials(), fetchImpl: oversized }), (error) => error.status === 422);
});

test("missing schedule tabs and unsupported grid sizes are rejected before reading values", async () => {
  const invalidMetadata = [
    metadata("APP_SCHEDULE copy"),
    metadata("APP_SCHEDULE", 1, 26),
    metadata("APP_SCHEDULE", 2001, 26),
    metadata("APP_SCHEDULE", 1000, 14),
    metadata("APP_SCHEDULE", 1000, 53),
  ];
  for (const meta of invalidMetadata) {
    let valueReads = 0;
    const fetchImpl = async (url) => {
      if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "safe-test-token", expires_in: 3600 });
      if (isMetadata(url)) return response(meta);
      valueReads += 1;
      return response({ values: values() });
    };
    await assert.rejects(fetchScheduleSheet({ spreadsheetId, credentials: credentials(), fetchImpl }), (error) => error instanceof RegistrationError && [422, 503].includes(error.status));
    assert.equal(valueReads, 0);
  }
  let requestedRange;
  const upperBoundary = async (url) => {
    if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "safe-test-token", expires_in: 3600 });
    if (isMetadata(url)) return response(metadata("APP_SCHEDULE", 2000, 52));
    requestedRange = decodeURIComponent(new URL(url).pathname.split("/values/")[1]);
    return response({ values: values() });
  };
  await fetchScheduleSheet({ spreadsheetId, credentials: credentials(), fetchImpl: upperBoundary });
  assert.equal(requestedRange, "'APP_SCHEDULE'!A1:AZ2000");
});

test("the full existing grid is read so late stray data and a 501st session cannot be silently truncated", async () => {
  const lateData = values();
  while (lateData.length < 749) lateData.push([]);
  lateData.push(["Unexpected content below the schedule"]);
  const tooManySessions = [SHEET_COLUMNS, ...Array.from({ length: 501 }, (_, index) => {
    const entry = [...values()[2]];
    entry[0] = `sheet-many-${index}`;
    entry[5] = `Room ${index}`;
    return entry;
  })];
  for (const catalog of [lateData, tooManySessions]) {
    const fetchImpl = async (url) => {
      if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "safe-test-token", expires_in: 3600 });
      if (isMetadata(url)) return response(metadata());
      const range = decodeURIComponent(new URL(url).pathname.split("/values/")[1]);
      assert.equal(range, "'APP_SCHEDULE'!A1:Z1000");
      const endRow = Number(range.match(/\d+$/)[0]);
      return response({ values: catalog.slice(0, endRow) });
    };
    await assert.rejects(fetchScheduleSheet({ spreadsheetId, credentials: credentials(), fetchImpl }), (error) => error.status === 422);
  }
});

test("sync checks the dashboard revision before contacting Google and retains state on failed reads", async () => withEnvironment({ REG2026_SCHEDULE_SHEET_ID: spreadsheetId, REG2026_SCHEDULE_SHEET_NAME: "APP_SCHEDULE" }, async () => {
  const publication = { id: 3, spreadsheetId, sheetName: "APP_SCHEDULE", count: 2, publishedAt: "2026-10-27T12:00:00Z" };
  let reads = 0;
  let writes = 0;
  const store = { schedulePublication: async () => publication, publishSchedule: async () => { writes += 1; } };
  const readSheet = async () => { reads += 1; throw new RegistrationError(422, "Fix the sheet.", { "row 2: format": "Choose a class format." }); };
  await assert.rejects(syncScheduleFromSheet(store, 2, readSheet), (error) => error.status === 409);
  for (const version of [-1, "3", null, NaN]) await assert.rejects(syncScheduleFromSheet(store, version, readSheet), (error) => error.status === 422);
  assert.equal(reads, 0);
  await assert.rejects(syncScheduleFromSheet(store, 3, readSheet), (error) => error.status === 422 && !!error.errors["row 2: format"]);
  assert.equal(reads, 1);
  assert.equal(writes, 0);
  assert.equal((await store.schedulePublication()).id, 3);
}));

test("sync publishes the validated source and returns accurate new and unchanged dashboard revisions", async () => withEnvironment({ REG2026_SCHEDULE_SHEET_ID: spreadsheetId, REG2026_SCHEDULE_SHEET_NAME: "APP_SCHEDULE" }, async () => {
  const snapshot = source(parseScheduleRows(values()));
  let publication = null;
  const store = {
    schedulePublication: async () => publication,
    schedule: async () => snapshot.sessions,
    publishSchedule: async (actual, version) => {
      assert.deepEqual(actual, snapshot);
      assert.equal(version, publication?.id || 0);
      publication ||= { id: 1, spreadsheetId, sheetName: "APP_SCHEDULE", count: 2, sourceHash: snapshot.sourceHash, publishedAt: "2026-10-27T12:00:00Z" };
      return publication;
    },
  };
  const readSheet = async (options) => {
    assert.deepEqual(options, { spreadsheetId, sheetName: "APP_SCHEDULE" });
    return snapshot;
  };
  const first = await syncScheduleFromSheet(store, 0, readSheet);
  assert.equal(first.unchanged, false);
  assert.equal(first.source.publication.id, 1);
  assert.deepEqual(first.schedule, snapshot.sessions);
  const repeated = await syncScheduleFromSheet(store, 1, readSheet);
  assert.equal(repeated.unchanged, true);
  assert.equal(repeated.source.publication.id, 1);
  store.publishSchedule = async () => { throw new RegistrationError(409, "An existing booking prevents this change."); };
  await assert.rejects(syncScheduleFromSheet(store, 1, readSheet), (error) => error.status === 409);
  assert.equal(publication.id, 1);
}));

test("dashboard remains accessible before first publication and preserves the published source without env", async () => withEnvironment({ REG2026_SCHEDULE_SHEET_ID: spreadsheetId, REG2026_SCHEDULE_SHEET_NAME: undefined }, async () => {
  let scheduleReads = 0;
  const store = {
    schedulePublication: async () => null,
    schedule: async () => { scheduleReads += 1; throw new Error("Do not load unpublished mocks"); },
  };
  const unpublished = await getScheduleAdminState(store);
  assert.deepEqual(unpublished.schedule, []);
  assert.equal(unpublished.source.configured, true);
  assert.equal(unpublished.source.publication, null);
  assert.equal(scheduleReads, 0);
  const publication = { id: 9, spreadsheetId, sheetName: "Published Schedule", count: 2, publishedAt: "2026-10-27T12:00:00Z" };
  const schedule = parseScheduleRows(values());
  store.schedulePublication = async () => publication;
  store.schedule = async () => schedule;
  delete process.env.REG2026_SCHEDULE_SHEET_ID;
  const published = await getScheduleAdminState(store);
  assert.equal(published.source.configured, true);
  assert.equal(published.source.sheetId, spreadsheetId);
  assert.equal(published.source.sheetName, "Published Schedule");
  assert.equal(published.source.publication.id, 9);
  assert.deepEqual(published.schedule, schedule);
  assert.ok(!Object.keys(published.source).some((key) => /privateKey|accessToken|clientEmail/.test(key)));
}));

const apiResponse = () => ({
  headers: {}, code: 200,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  end() { return this; },
});

test("schedule HTTP endpoint requires organizer authentication and same-origin writes without reading the operational database", async () => withEnvironment({
  ADMIN_USER: "sheet-organizer", ADMIN_SESSION_SECRET: "sheet-test-organizer-session-secret", REG2026_SCHEDULE_SHEET_ID: spreadsheetId,
}, async () => {
  const dbPath = require.resolve("../db/reg2026");
  const endpointPath = require.resolve("../pages/api/reg2026/schedule");
  const previousDb = require.cache[dbPath];
  const previousEndpoint = require.cache[endpointPath];
  let reads = 0;
  const store = {
    schedulePublication: async () => { reads += 1; return null; },
    schedule: async () => { throw new Error("Unpublished schedule should not be read"); },
  };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { registrationStore: store } };
  delete require.cache[endpointPath];
  try {
    const handler = require("../pages/api/reg2026/schedule").default;
    const loggedOut = apiResponse();
    await handler({ method: "GET", headers: {} }, loggedOut);
    assert.equal(loggedOut.code, 401);
    assert.equal(reads, 0);
    assert.equal(loggedOut.headers["Cache-Control"], "private, no-store");
    const login = apiResponse();
    setAdminSession(login);
    const cookie = login.headers["Set-Cookie"].split(";")[0];
    const crossOrigin = apiResponse();
    await handler({ method: "POST", headers: { cookie, host: "register.example.com", origin: "https://different.example.com" }, body: { action: "sync", version: 0 } }, crossOrigin);
    assert.equal(crossOrigin.code, 403);
    assert.equal(reads, 0);
    const authenticated = apiResponse();
    await handler({ method: "GET", headers: { cookie, host: "register.example.com" } }, authenticated);
    assert.equal(authenticated.code, 200);
    assert.deepEqual(authenticated.body.schedule, []);
    assert.equal(authenticated.body.source.sheetId, spreadsheetId);
    const rejectedEdit = apiResponse();
    await handler({ method: "POST", headers: { cookie, host: "register.example.com", origin: "https://register.example.com" }, body: { id: "sheet-session-a", version: 0, values: { title: "Local override" } } }, rejectedEdit);
    assert.equal(rejectedEdit.code, 409);
    const unsupported = apiResponse();
    await handler({ method: "DELETE", headers: { cookie } }, unsupported);
    assert.equal(unsupported.code, 405);
    assert.equal(unsupported.headers.Allow, "GET, POST");
  } finally {
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousEndpoint) require.cache[endpointPath] = previousEndpoint;
    else delete require.cache[endpointPath];
  }
}));
