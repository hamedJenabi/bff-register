import { createHash, createSign } from "node:crypto";
import { RegistrationError } from "./errors";
import { parseScheduleRows } from "./sheet-schema";

const READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 15000;
const cachedTokens = new Map();
const scheduleHash = (sessions) => createHash("sha256").update(JSON.stringify(sessions)).digest("hex");

const credentialsFromEnvironment = () => ({
  email: process.env.REG2026_GOOGLE_CLIENT_EMAIL || process.env.REACT_APP_GOOGLE_CLIENT_EMAIL || "",
  privateKey: (process.env.REG2026_GOOGLE_PRIVATE_KEY || process.env.REACT_APP_GOOGLE_SERVICE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
});

export const getScheduleSource = (publication = null) => {
  const credentials = credentialsFromEnvironment();
  const sheetId = process.env.REG2026_SCHEDULE_SHEET_ID || publication?.spreadsheetId || null;
  const sheetName = process.env.REG2026_SCHEDULE_SHEET_NAME || publication?.sheetName || "APP_SCHEDULE";
  const gid = process.env.REG2026_SCHEDULE_SHEET_GID;
  return {
    configured: !!sheetId, sheetId, sheetName,
    url: sheetId ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit${/^\d+$/.test(gid || "") ? `#gid=${gid}` : ""}` : null,
    credentialsConfigured: !!(credentials.email && credentials.privateKey),
    publication,
  };
};

// Google credentials never leave this server module or appear in API diagnostics.
const requestJson = async (fetchImpl, url, options, errorMessage) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new RegistrationError(503, errorMessage);
    const text = await response.text();
    if (text.length > 4 * 1024 * 1024) throw new RegistrationError(422, "The schedule sheet response is too large. Keep the APP_SCHEDULE tab to 500 sessions.");
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof RegistrationError) throw error;
    throw new RegistrationError(503, errorMessage);
  } finally { clearTimeout(timer); }
};

const accessToken = async (credentials, fetchImpl, scope = READ_SCOPE) => {
  const { email, privateKey } = credentials;
  if (!email || !privateKey) throw new RegistrationError(503, "Configure the Google service-account email and private key before syncing the schedule.");
  const key = createHash("sha256").update(email).update(privateKey).update(scope).digest("hex");
  const cachedToken = cachedTokens.get(key);
  if (cachedToken?.expiresAt > Date.now() + 60000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  let signature;
  try { signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url"); }
  catch { throw new RegistrationError(503, "The Google service-account private key is invalid. Check the server configuration."); }
  const token = await requestJson(fetchImpl, TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }).toString(),
  }, "Google authentication failed. Check the service-account credentials and enable the Google Sheets API.");
  if (typeof token.access_token !== "string" || !token.access_token || !Number.isFinite(token.expires_in)) throw new RegistrationError(503, "Google authentication did not return a usable access token.");
  cachedTokens.set(key, { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 });
  return token.access_token;
};

const readScheduleGrid = async ({ spreadsheetId, sheetName = "APP_SCHEDULE", fetchImpl = globalThis.fetch, credentials = credentialsFromEnvironment() }) => {
  if (typeof spreadsheetId !== "string" || !/^[a-zA-Z0-9_-]{10,200}$/.test(spreadsheetId) ||
      typeof sheetName !== "string" || !sheetName.trim() || sheetName.length > 100) throw new RegistrationError(503, "Configure a valid schedule spreadsheet ID and tab name.");
  const token = await accessToken(credentials, fetchImpl);
  const accessError = `Could not read the schedule. Share this workbook with ${credentials.email} as Viewer, enable the Google Sheets API, and check the ${sheetName} tab.`;
  const headers = { Authorization: `Bearer ${token}` };
  const metadata = await requestJson(fetchImpl, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(title,gridProperties(rowCount,columnCount)))`, { headers }, accessError);
  const grid = metadata.sheets?.find((sheet) => sheet.properties?.title === sheetName)?.properties?.gridProperties;
  if (!grid) throw new RegistrationError(422, `The schedule workbook needs an ${sheetName} tab.`);
  if (!Number.isInteger(grid.rowCount) || grid.rowCount < 2 || grid.rowCount > 2000 ||
      !Number.isInteger(grid.columnCount) || grid.columnCount < 15 || grid.columnCount > 52) {
    throw new RegistrationError(422, "Keep the schedule tab between 2 and 2000 rows and 15 and 52 columns, with at most 500 sessions.");
  }
  // Read the entire bounded tab, including blank separators and stray trailing data.
  let column = grid.columnCount, lastColumn = "";
  while (column > 0) { column -= 1; lastColumn = String.fromCharCode(65 + column % 26) + lastColumn; column = Math.floor(column / 26); }
  const range = `'${sheetName.replace(/'/g, "''")}'!A1:${lastColumn}${grid.rowCount}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  const data = await requestJson(fetchImpl, url, { headers }, accessError);
  return { values: data.values, range };
};

export const fetchScheduleSheet = async (options) => {
  const { values } = await readScheduleGrid(options);
  const sessions = parseScheduleRows(values);
  return { spreadsheetId: options.spreadsheetId, sheetName: options.sheetName || "APP_SCHEDULE", sessions, sourceHash: scheduleHash(sessions) };
};

const columnName = (index) => {
  let value = index + 1, name = "";
  while (value > 0) { value -= 1; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26); }
  return name;
};

export const writeScheduleCapacityToSheet = async ({ publication, id, capacity, sessions,
  fetchImpl = globalThis.fetch, credentials = credentialsFromEnvironment() }) => {
  const options = { spreadsheetId: publication.spreadsheetId, sheetName: publication.sheetName, fetchImpl, credentials };
  const { values } = await readScheduleGrid(options);
  const current = parseScheduleRows(values);
  if (scheduleHash(current) !== publication.sourceHash) {
    throw new RegistrationError(409, "Google Sheets has unpublished changes. Sync the schedule before editing capacities.");
  }
  const headers = values[0].map((value) => typeof value === "string" ? value.trim() : "");
  const idColumn = headers.indexOf("session_id");
  const row = values.findIndex((entry, index) => index > 0 && String(entry[idColumn] || "").trim() === id);
  if (row < 1) throw new RegistrationError(409, "This class is no longer in Google Sheets. Sync the schedule before editing capacities.");
  const rangePrefix = `'${publication.sheetName.replace(/'/g, "''")}'!`;
  const data = ["lead", "follow", "total"].map((pool) => ({
    range: `${rangePrefix}${columnName(headers.indexOf(`${pool}_capacity`))}${row + 1}`,
    values: [[capacity[pool] ?? ""]],
  }));
  const token = await accessToken(credentials, fetchImpl, WRITE_SCOPE);
  await requestJson(fetchImpl, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(publication.spreadsheetId)}/values:batchUpdate`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  }, `Could not confirm the capacity update. The published schedule was kept. Google Sheets must give ${credentials.email} Editor access. Reload and sync before retrying.`);
  let saved;
  try { saved = await fetchScheduleSheet(options); }
  catch { throw new RegistrationError(503, "Could not verify the Google Sheets update. The published schedule was kept. Reload and sync before retrying."); }
  if (saved.sourceHash !== scheduleHash(sessions)) {
    throw new RegistrationError(409, "Google Sheets changed while capacity was being saved. The published schedule was kept. Review the sheet and sync again.");
  }
};

export const getScheduleAdminState = async (store) => {
  const publication = await store.schedulePublication();
  const source = getScheduleSource(publication);
  // Organizers must be able to reach Sync before the first valid publication.
  const schedule = source.configured && !publication ? [] : await store.schedule();
  return { schedule, source };
};

export const syncScheduleFromSheet = async (store, version, readSheet = fetchScheduleSheet) => {
  if (!Number.isSafeInteger(version) || version < 0) throw new RegistrationError(422, "Reload the schedule dashboard before syncing.");
  const publication = await store.schedulePublication();
  if (version !== (publication?.id || 0)) throw new RegistrationError(409, "The published schedule changed in another session. Reload before syncing again.");
  const source = getScheduleSource(publication);
  if (!source.sheetId) throw new RegistrationError(503, "Configure REG2026_SCHEDULE_SHEET_ID before syncing.");
  const snapshot = await readSheet({ spreadsheetId: source.sheetId, sheetName: source.sheetName });
  const next = await store.publishSchedule(snapshot, version);
  return { ...(await getScheduleAdminState(store)), unchanged: next.id === publication?.id };
};

export const saveScheduleCapacity = async (store, { id, capacity, version }, writeSheet = writeScheduleCapacityToSheet) => {
  const publication = await store.schedulePublication();
  const source = getScheduleSource(publication);
  if (!publication) throw new RegistrationError(409, "Sync the schedule once before editing capacities here.");
  if (source.sheetId !== publication.spreadsheetId || source.sheetName !== publication.sheetName) {
    throw new RegistrationError(409, "Sync the configured Google Sheets source before editing capacities.");
  }
  const saved = await store.editPublishedCapacity(id, capacity, version, writeSheet);
  return { ...(await getScheduleAdminState(store)), unchanged: saved.id === publication.id };
};
