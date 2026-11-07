import { useEffect, useState } from "react";
import { competitions } from "../../lib/reg2026/catalog";
import styles from "../../pages/dashboard/Schedule.module.scss";

const roleLabels = { lead: "Lead", follow: "Follow", total: "All entries" };

function CompetitionRow({ competition, pool, entry, disabled, onBusyChange, onSave }) {
  const [value, setValue] = useState(String(entry?.capacity ?? ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(String(entry?.capacity ?? "")); }, [entry?.capacity]);
  const label = `${competition.label}, ${roleLabels[pool]}`;
  const changed = value !== String(entry?.capacity ?? "");
  const over = entry && !entry.unlimited && entry.registered + entry.held > entry.capacity;
  const submit = async (event) => {
    event.preventDefault();
    if (!changed || disabled || saving || !entry) return;
    setSaving(true); setError(""); onBusyChange(true);
    try {
      const response = await fetch("/api/reg2026/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "competition-capacity", id: competition.id, pool, capacity: value, version: entry.version }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save competition capacity.");
      setValue(String(Number(value)));
      onSave(result);
    } catch (error) { setError(error.message || "Could not save capacity. Please try again."); }
    finally { setSaving(false); onBusyChange(false); }
  };
  return <>
    <tr role="row">
      <th role="rowheader" scope="row">{roleLabels[pool]}</th>
      <td role="cell" className={styles.number}><span className={styles.mobileLabel} aria-hidden="true">Capacity</span>{entry?.unlimited ? "Unlimited" : entry?.capacity ?? "—"}</td>
      <td role="cell" className={styles.number}><span className={styles.mobileLabel} aria-hidden="true">Registered</span>{entry?.registered ?? "—"}</td>
      <td role="cell" className={styles.number}><span className={styles.mobileLabel} aria-hidden="true">On hold</span>{entry?.held ?? "—"}</td>
      <td role="cell" className={`${styles.number} ${entry?.remaining === 0 ? styles.full : styles.available}`}
        title={over ? `${entry.registered + entry.held - entry.capacity} over capacity. Existing entries are kept.` : undefined}>
        <span className={styles.mobileLabel} aria-hidden="true">Remaining</span>
        {entry?.unlimited ? "Open" : entry?.remaining ?? "—"}{over ? "*" : ""}
      </td>
      <td role="cell" className={styles.capacityEdit}>{!competition.capacity ? <span className={styles.unlimitedNote}>No limit</span> : <form onSubmit={submit} className={styles.rowCapacityForm} aria-busy={saving}>
        <span className={styles.mobileLabel} aria-hidden="true">Edit capacity</span>
        <label className={styles.srOnly} htmlFor={`competition-capacity-${competition.id}-${pool}`}>Capacity for {label}</label>
        <input id={`competition-capacity-${competition.id}-${pool}`} name="capacity" type="number" min={0} max={1000} step={1} required
          value={value} disabled={disabled || saving || !entry} onChange={(event) => { setValue(event.target.value); setError(""); }} />
        <button type="submit" disabled={disabled || saving || !entry || !changed} aria-label={`Save capacity for ${label}`}>{saving ? "Saving…" : "Save"}</button>
      </form>}</td>
    </tr>
    {error && <tr role="row" className={styles.rowError}><td role="cell" colSpan={6}><p role="alert">{label}: {error}</p></td></tr>}
  </>;
}

export default function CompetitionOverview({ inventory, disabled, onBusyChange, onSave, onRefresh, refreshing }) {
  const totals = Object.values(inventory).flatMap(Object.values).reduce((sum, entry) => ({
    registered: sum.registered + entry.registered, held: sum.held + entry.held,
  }), { registered: 0, held: 0 });
  return <section className={styles.capacityOverview} aria-label="Competition capacity overview">
    <div className={styles.overviewHeading}>
      <div><h2>Competition overview</h2><p>{competitions.length} competitions <span>·</span> {totals.registered} registered {totals.registered === 1 ? "entry" : "entries"} <span>·</span> {totals.held} {totals.held === 1 ? "place" : "places"} on hold</p></div>
      <button type="button" className={styles.refreshButton} disabled={disabled || refreshing} onClick={onRefresh}>{refreshing ? "Refreshing…" : "Refresh counts"}</button>
    </div>
    <p className={styles.overviewHint}>Remaining places account for registered entries and active checkout holds. Lead and Follow have independent limits.</p>
    {competitions.map((competition) => <section key={competition.id} className={styles.capacitySlot} aria-labelledby={`competition-heading-${competition.id}`}>
      <header><h3 id={`competition-heading-${competition.id}`}>{competition.label}</h3><span>{competition.roleRequired ? "Capacity per role" : competition.capacity ? "Total capacity" : "No capacity limit"}</span></header>
      <div className={styles.capacityTableScroll} tabIndex={0} role="region" aria-label={`${competition.label} capacities`}>
        <table role="table" className={`${styles.capacityTable} ${styles.competitionTable}`}>
          <colgroup><col className={styles.roleColumn} /><col /><col /><col /><col /><col className={styles.editColumn} /></colgroup>
          <thead role="rowgroup"><tr role="row"><th scope="col">Role</th><th scope="col">Capacity</th><th scope="col">Registered</th><th scope="col">On hold</th><th scope="col">Remaining</th><th scope="col">Edit capacity</th></tr></thead>
          <tbody role="rowgroup">{Object.keys(competition.capacity || { total: null }).map((pool) => <CompetitionRow key={pool} competition={competition} pool={pool}
            entry={inventory[competition.id]?.[pool]} disabled={disabled || refreshing} onBusyChange={onBusyChange} onSave={onSave} />)}</tbody>
        </table>
      </div>
    </section>)}
    <p className={styles.overviewHint}>Capacity changes apply immediately to registration. Existing entries are kept, even when a reduced capacity leaves a competition full.</p>
  </section>;
}
