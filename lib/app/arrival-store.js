import { titleCase } from "../../utils/functions";
import { competitions } from "../reg2026/catalog";
import { commaList } from "../reg2026/serialization";
import { tokenId, validCredential } from "./security";

const competitionLabels = new Map(
  competitions.map(({ id, label }) => [id, label]),
);
const passLabels = {
  fullpass: "Full Pass",
  partyPass: "Party Pass",
  parentPass: "Parent Pass",
};
const noAddOn = /^(?:no(?: t[- ]?shirt)?|none)$/i;
const addOns = (value) =>
  commaList(value)
    .map((item) => item.trim())
    .filter((item) => item && !noAddOn.test(item));

const scanDetails = (scan) => ({
  id: scan.id,
  name: `${scan.firstname} ${scan.lastname}`.trim(),
  pass: passLabels[scan.ticket] || scan.ticket,
  lunch: addOns(scan.lunch).map(titleCase),
  tshirt: addOns(scan.tshirt).join(", ") || null,
  competitions: addOns(scan.competitions).map(
    (entry) =>
      competitionLabels.get(entry.toLowerCase().replace(/\s+/g, "_")) ||
      titleCase(entry),
  ),
});

export const createArrivalStore = (sql) => ({
  scan: async (qr) => {
    const credentialId = tokenId(qr, "qr");
    if (!credentialId) return { status: "invalid" };
    return sql.begin(async (tx) => {
      const [access] = await tx`SELECT a.* FROM attendee_access_26 a
        JOIN registrations_26 r ON r.id = a.registration_id
        WHERE a.id = ${credentialId} AND r.status = 'confirmed' FOR UPDATE OF r`;
      if (!validCredential(access, qr, "qr")) return { status: "invalid" };

      const [arrival] =
        await tx`INSERT INTO festival_arrivals_26 (registration_id)
        VALUES (${access.registration_id}) ON CONFLICT (registration_id)
        DO UPDATE SET registration_id = EXCLUDED.registration_id RETURNING checked_in_at`;
      return { status: arrival.checked_in_at ? "alreadyCheckedIn" : "queued" };
    });
  },
  dashboard: async () => {
    const [state] = await sql`SELECT
      ARRAY(SELECT registration_id FROM festival_arrivals_26 WHERE checked_in_at IS NOT NULL) AS "checkedInIds",
      (SELECT row_to_json(pending) FROM (
        SELECT a.id, r.firstname, r.lastname, r.ticket, r.lunch, r.tshirt, r.competitions
        FROM festival_arrivals_26 a JOIN registrations_26 r ON r.id = a.registration_id
        WHERE a.checked_in_at IS NULL AND r.status = 'confirmed'
        ORDER BY a.id LIMIT 1
      ) pending) AS scan`;
    return {
      checkedInIds: state.checkedInIds,
      scan: state.scan ? scanDetails(state.scan) : null,
    };
  },
  confirm: (id) =>
    sql.begin(async (tx) => {
      const [person] = await tx`SELECT r.status FROM registrations_26 r
      JOIN festival_arrivals_26 a ON a.registration_id = r.id WHERE a.id = ${id} FOR UPDATE OF r`;
      if (person?.status !== "confirmed") return;
      await tx`UPDATE festival_arrivals_26 SET checked_in_at = NOW() WHERE id = ${id} AND checked_in_at IS NULL`;
    }),
  dismiss: (id) =>
    sql`DELETE FROM festival_arrivals_26 WHERE id = ${id} AND checked_in_at IS NULL`,
  undo: (registrationId) =>
    sql`DELETE FROM festival_arrivals_26 WHERE registration_id = ${registrationId} AND checked_in_at IS NOT NULL`,
});
