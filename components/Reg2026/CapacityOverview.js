import { useEffect, useState } from "react";
import { scheduleDays } from "../../lib/reg2026/catalog";
import { scheduleFormValues } from "../../lib/reg2026/schedule";
import styles from "../../pages/dashboard/Schedule.module.scss";

function CapacityRow({ session, inventory, sheetsMode, version, disabled, onBusyChange, onSave }) {
  const total = session.capacity.total;
  const [value, setValue] = useState(String(total ?? ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(String(total ?? "")); }, [total]);
  const open = session.format === "talk";
  const changed = value !== String(total ?? "");
  const label = `${session.title}, ${session.day} ${session.start}`;
  const over = !open && inventory && inventory.registered + inventory.held > total;
  const remaining = inventory?.remaining;
  const highlight = !open && Number.isFinite(remaining)
    ? remaining <= 5 ? styles.capacityCritical : remaining < 15 ? styles.capacityLow : remaining < 20 ? styles.capacityNotice : ""
    : "";
  const rowClassName = [session.bookable === false ? styles.notBookable : "", highlight].filter(Boolean).join(" ");
  const submit = async (event) => {
    event.preventDefault();
    if (!changed || saving || disabled) return;
    setSaving(true); setError(""); onBusyChange(true);
    try {
      const body = sheetsMode ? { action: "capacity", id: session.id, version, capacity: { total: value } }
        : { id: session.id, version: session.version, values: { ...scheduleFormValues(session), totalCapacity: value } };
      const response = await fetch("/api/reg2026/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.errors?.totalCapacity || result.error || "Could not save capacity.");
      setValue(String(Number(value)));
      onSave(result);
    } catch (error) { setError(error.message || "Could not save capacity. Please try again."); }
    finally { setSaving(false); onBusyChange(false); }
  };
  const roles = inventory?.roles;
  const roleSummary = session.partnerClass && roles ? ["lead", "follow", "switch"].map((role) => `${role}: ${roles[role]?.registered || 0}`).join(" · ") : undefined;
  return <>
    <tr role="row" className={rowClassName || undefined}>
      <th role="rowheader" scope="row" title={`${label} · ${session.teachers}`}><span className={styles.className}>{session.title}</span>
        {session.bookable === false && <span className={styles.rowBadge}>{open ? "Talk" : "Closed"}</span>}</th>
      <td role="cell" className={styles.classRoom} title={session.room}>{session.room || "TBA"}</td>
      <td role="cell" className={styles.number}><span className={styles.mobileLabel} aria-hidden="true">Capacity</span>{open ? "Unlimited" : total}</td>
      <td role="cell" className={styles.number} title={roleSummary}><span className={styles.mobileLabel} aria-hidden="true">Registered</span>{inventory?.registered ?? "—"}</td>
      <td role="cell" className={styles.number}><span className={styles.mobileLabel} aria-hidden="true">On hold</span>{inventory?.held ?? "—"}</td>
      <td role="cell" className={`${styles.number} ${!open && inventory?.remaining === 0 ? styles.full : styles.available}`}
        title={over ? `${inventory.registered + inventory.held - total} over capacity. Existing bookings are kept.` : undefined}>
        <span className={styles.mobileLabel} aria-hidden="true">Remaining</span>
        {open ? "Open" : inventory?.remaining ?? "—"}{over ? "*" : ""}</td>
      <td role="cell" className={`${styles.number} ${session.partnerClass && inventory?.followRemaining === 0 ? styles.full : ""}`}>
        <span className={styles.mobileLabel} aria-hidden="true">Follow left</span>
        {session.partnerClass ? inventory?.followRemaining ?? "—" : "—"}</td>
      <td role="cell" className={styles.capacityEdit}>{open ? <span className={styles.unlimitedNote}>No limit</span> : <form onSubmit={submit} className={styles.rowCapacityForm} aria-busy={saving}>
        <span className={styles.mobileLabel} aria-hidden="true">Edit capacity</span>
        <label className={styles.srOnly} htmlFor={`overview-capacity-${session.id}`}>Capacity for {label}</label>
        <input id={`overview-capacity-${session.id}`} name="capacity" type="number" min={0} max={1000} step={1} required
          value={value} disabled={disabled || saving} onChange={(event) => { setValue(event.target.value); setError(""); }} />
        <button type="submit" disabled={disabled || saving || !changed} aria-label={`Save capacity for ${label}`}>{saving ? "Saving…" : "Save"}</button>
      </form>}</td>
    </tr>
    {error && <tr role="row" className={styles.rowError}><td role="cell" colSpan={8}><p role="alert">{session.title}: {error}</p></td></tr>}
  </>;
}

export default function CapacityOverview({ sessions, inventory, classRegistrantCount, source, sheetsMode, disabled, onBusyChange, onSave, onRefresh, refreshing }) {
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const filtered = sessions.filter((session) => (!day || session.day === day) &&
    [session.title, session.teachers, session.room].some((value) => value?.toLowerCase().includes(query.trim().toLowerCase())));
  const groups = scheduleDays.flatMap((day) => [...new Set(filtered.filter((session) => session.day === day).map((session) => `${session.start}–${session.end}`))].sort()
    .map((time) => ({ day, time, sessions: filtered.filter((session) => session.day === day && `${session.start}–${session.end}` === time)
      .sort((a, b) => (inventory[b.id]?.registered ?? -1) - (inventory[a.id]?.registered ?? -1)) })));
  const heldPlaces = sessions.reduce((sum, session) => sum + (inventory[session.id]?.held || 0), 0);
  const cannotEdit = disabled || (sheetsMode && (!source.publication || !source.credentialsConfigured));
  return <section className={styles.capacityOverview} aria-label="Class capacity overview">
    <div className={styles.overviewHeading}>
      <div><h2>Capacity overview</h2><p>{sessions.length} classes <span>·</span> {classRegistrantCount} {classRegistrantCount === 1 ? "user" : "users"} registered for classes <span>·</span> {heldPlaces} places on hold</p></div>
      <button type="button" className={styles.refreshButton} disabled={disabled || refreshing} onClick={onRefresh}>{refreshing ? "Refreshing…" : "Refresh counts"}</button>
    </div>
    <div className={styles.overviewToolbar}>
      <label className={styles.srOnly} htmlFor="capacity-search">Search classes, teachers or rooms</label>
      <input id="capacity-search" type="search" placeholder="Search classes, teachers or rooms" value={query} onChange={(event) => setQuery(event.target.value)} />
      <label className={styles.srOnly} htmlFor="capacity-day">Filter capacity by day</label>
      <select id="capacity-day" value={day} onChange={(event) => setDay(event.target.value)}><option value="">All days</option>{scheduleDays.map((day) => <option key={day}>{day}</option>)}</select>
      <span>{filtered.length} {filtered.length === 1 ? "class" : "classes"}</span>
    </div>
    <p className={styles.overviewHint}>Capacity is the total before bookings. Remaining places account for registrations and active checkout holds. Followers can fill up to 50% of a partner class.</p>
    <div className={styles.capacityLegend} aria-label="Remaining places highlighting">
      <span className={styles.capacityNotice}>15–19 remaining</span>
      <span className={styles.capacityLow}>6–14 remaining</span>
      <span className={styles.capacityCritical}>5 or fewer remaining</span>
    </div>
    {cannotEdit && sheetsMode && <p className={styles.overviewHint}>Capacity editing needs a published schedule and configured Google Sheets access.</p>}
    {!groups.length && <p className={styles.emptyOverview}>{sessions.length ? "No classes match your filters." : "Sync the schedule to see classes and capacities here."}</p>}
    {groups.map((group, index) => <section key={`${group.day}-${group.time}`} className={styles.capacitySlot} aria-labelledby={`capacity-slot-${index}`}>
      <header><h3 id={`capacity-slot-${index}`}>{group.day} <span>{group.time}</span></h3><span>{group.sessions.length} {group.sessions.length === 1 ? "class" : "classes"}</span></header>
      <div className={styles.capacityTableScroll} tabIndex={0} role="region" aria-label={`${group.day} ${group.time} capacities`}>
        <table role="table" className={styles.capacityTable}>
          <colgroup><col className={styles.classColumn} /><col className={styles.roomColumn} /><col /><col /><col /><col /><col /><col className={styles.editColumn} /></colgroup>
          <thead role="rowgroup"><tr role="row"><th scope="col">Class</th><th scope="col">Room</th><th scope="col">Capacity</th><th scope="col">Registered</th><th scope="col">On hold</th><th scope="col">Remaining</th><th scope="col">Follow left</th><th scope="col">Edit capacity</th></tr></thead>
          <tbody role="rowgroup">{group.sessions.map((session) => <CapacityRow key={session.id} session={session} inventory={inventory[session.id]} sheetsMode={sheetsMode}
            version={source?.publication?.id} disabled={cannotEdit || refreshing} onBusyChange={onBusyChange} onSave={onSave} />)}</tbody>
        </table>
      </div>
    </section>)}
    {sheetsMode && <p className={styles.overviewHint}>Saving updates Google Sheets and publishes the capacity. Existing registrations are kept, even if a reduced capacity leaves the class full.</p>}
  </section>;
}
