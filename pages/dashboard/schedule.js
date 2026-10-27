import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import {
  unstable_useFormState as useFormState, unstable_Form as Form,
  unstable_FormInput as FormInput, unstable_FormLabel as FormLabel,
  unstable_FormCheckbox as FormCheckbox, unstable_FormMessage as FormMessage,
  unstable_FormSubmitButton as FormSubmitButton,
} from "reakit/Form";
import { adminPageRedirect } from "../../lib/admin/session";
import { scheduleDays } from "../../lib/reg2026/catalog";
import { scheduleFormValues, validateSchedule } from "../../lib/reg2026/schedule";
import styles from "./Schedule.module.scss";

function ClassEditor({ session, onSave }) {
  const form = useFormState({
    baseId: `schedule-editor-${session.id}`, resetOnUnmount: false,
    values: scheduleFormValues(session),
    onValidate: (values) => {
      const result = validateSchedule(values);
      if (!result.valid) throw result.errors;
    },
    onSubmit: async (values) => {
      try {
        const response = await fetch("/api/reg2026/schedule", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: session.id, version: session.version, values }) });
        const result = await response.json();
        if (!response.ok) throw { ...result.errors, formError: result.error || "Could not save class details." };
        onSave(result.schedule);
      } catch (error) {
        if (error.formError) throw error;
        throw { formError: error.message || "Could not save class details." };
      }
    },
  });
  const field = (name, label, props = {}) => <div className={styles.field}>
    <FormLabel {...form} name={name}>{label}</FormLabel>
    <FormInput {...form} name={name} disabled={form.submitting} {...props} />
    <FormMessage {...form} name={name} />
  </div>;
  return <Form {...form} className={styles.editor} aria-busy={form.submitting}>
    <h2>Edit class</h2>
    {field("title", "Class title", { maxLength: 200 })}
    {field("teachers", "Teachers", { maxLength: 200 })}
    {field("description", "Description", { as: "textarea", rows: 6, maxLength: 6000 })}
    <div className={styles.grid}>
      <div className={styles.field}>
        <FormLabel {...form} name="day">Day</FormLabel>
        <FormInput {...form} name="day" as="select" disabled={form.submitting}>
          {scheduleDays.map((day) => <option key={day} value={day}>{day}</option>)}
        </FormInput>
        <FormMessage {...form} name="day" />
      </div>
      {field("room", "Classroom", { maxLength: 200 })}
      {field("start", "Start time", { type: "time" })}
      {field("end", "End time", { type: "time" })}
    </div>
    <label className={styles.checkbox}>
      <FormCheckbox {...form} name="partnerClass" disabled={form.submitting} /> Partner class (lead / follow)
    </label>
    <FormMessage {...form} name="partnerClass" />
    <div className={styles.grid}>
      {form.values.partnerClass ? <>
        {field("leadCapacity", "Lead capacity", { type: "number", min: 0, max: 1000, step: 1 })}
        {field("followCapacity", "Follow capacity", { type: "number", min: 0, max: 1000, step: 1 })}
      </> : field("totalCapacity", "Total capacity", { type: "number", min: 0, max: 1000, step: 1 })}
    </div>
    <p className={styles.hint}>For classes with registrations, day, times and class type stay fixed. Capacity changes affect remaining places.</p>
    <FormMessage {...form} name="formError" />
    <div className={styles.actions}>
      <FormSubmitButton {...form} disabled={form.submitting}>{form.submitting ? "Saving…" : "Save class"}</FormSubmitButton>
      <button type="button" disabled={form.submitting} onClick={form.reset} className={styles.secondary}>Discard changes</button>
    </div>
  </Form>;
}

const diagnosticMessages = (value, prefix = "") => {
  if (typeof value === "string") return [prefix ? `${prefix}: ${value}` : value];
  if (Array.isArray(value)) return value.flatMap((entry) => diagnosticMessages(entry, prefix));
  if (value && typeof value === "object") return Object.entries(value)
    .flatMap(([key, entry]) => diagnosticMessages(entry, prefix ? `${prefix} · ${key}` : key));
  return [];
};

const publishedTime = (value) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Vienna",
}).format(new Date(value));

function ClassPreview({ session }) {
  return <section className={styles.preview} aria-labelledby="published-class-title">
    <p className={styles.eyebrow}>Published class</p>
    <h2 id="published-class-title">{session.title}</h2>
    <p className={styles.teachers}>{session.teachers}</p>
    <dl className={styles.details}>
      <div><dt>When</dt><dd>{session.day}{session.date ? ` · ${session.date}` : ""} · {session.start}–{session.end}</dd></div>
      <div><dt>Room</dt><dd>{session.room || "To be announced"}</dd></div>
      <div><dt>Format</dt><dd>{session.partnerClass ? "Partner class · lead / follow" : session.format === "talk" ? "Talk" : "Solo class"}</dd></div>
      {session.levels && <div><dt>Levels</dt><dd>{Array.isArray(session.levels) ? session.levels.join(", ") : session.levels}</dd></div>}
      <div><dt>Capacity</dt><dd>{session.partnerClass
        ? `${session.capacity.lead} lead · ${session.capacity.follow} follow`
        : session.format === "talk" ? "Open · no capacity limit" : `${session.capacity.total} places`}</dd></div>
      {session.bookable === false && <div><dt>Registration</dt><dd>Not available for self-service booking</dd></div>}
    </dl>
    <h3>Description</h3>
    <p className={styles.description}>{session.description || "No description provided."}</p>
    <p className={styles.hint}>Edit these details in Google Sheets, then sync the schedule to publish your changes.</p>
  </section>;
}

export default function ScheduleAdmin({ initial, source: initialSource, loadError }) {
  const [sessions, setSessions] = useState(initial || []);
  const [source, setSource] = useState(initialSource || null);
  const [selected, setSelected] = useState(initial?.[0]?.id || "");
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [diagnostics, setDiagnostics] = useState([]);
  const sheetsMode = !!(source?.configured || source?.publication);
  const active = sessions.find((session) => session.id === selected);
  const filtered = sessions.filter((session) => (!day || session.day === day) &&
    [session.title, session.teachers].some((text) => text.toLowerCase().includes(query.trim().toLowerCase())));
  const updatePublished = (result) => {
    setSessions(result.schedule || []);
    setSource(result.source || null);
    setSelected((current) => result.schedule?.some((session) => session.id === current)
      ? current : result.schedule?.[0]?.id || "");
  };
  const syncSchedule = async () => {
    setSyncing(true); setMessage(""); setSyncError(""); setDiagnostics([]);
    try {
      const response = await fetch("/api/reg2026/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", version: source?.publication?.id || 0 }),
      });
      const result = await response.json();
      if (!response.ok) {
        setSyncError(result.error || "Could not sync the schedule. The published schedule has been kept.");
        setDiagnostics(diagnosticMessages(result.errors));
        if (response.status === 409) {
          const current = await fetch("/api/reg2026/schedule");
          if (current.ok) updatePublished(await current.json());
        }
        return;
      }
      updatePublished(result);
      setMessage(result.unchanged ? "The published schedule is already up to date."
        : "Schedule published. Registration and the participant app now use these details.");
    } catch {
      setSyncError("Could not sync the schedule. Please try again. The published schedule has been kept.");
    } finally { setSyncing(false); }
  };
  return <main className={styles.page}>
    <Head><title>Schedule · Blues Fever dashboard</title><meta name="robots" content="noindex,nofollow" /></Head>
    <nav className={styles.navigation} aria-label="Dashboard pages">
      <Link href="/dashboard/admin">Registrations</Link><Link href="/dashboard/schedule" aria-current="page">Schedule</Link>
    </nav>
    <header className={styles.header}><h1>Schedule</h1><p>{sheetsMode
      ? "Edit the schedule in Google Sheets, then sync it here to publish a complete update."
      : "Edit class details for the registration form. Mock classes appear until you save changes."}</p></header>
    {sheetsMode && <section className={styles.source} aria-labelledby="schedule-source-title" aria-busy={syncing}>
      <h2 id="schedule-source-title">Google Sheets schedule</h2>
      {source.publication ? <p>Last published {publishedTime(source.publication.publishedAt)} Vienna time · {source.publication.count} sessions</p>
        : <p>No schedule has been published yet. Complete the sheet, then sync it here.</p>}
      <p>Each sync checks the full schedule. If a row needs correction, the current published schedule stays available.</p>
      {!source.credentialsConfigured && <p>Google access needs to be configured before the schedule can be synced.</p>}
      <div className={styles.actions}>
        {source.url && <a href={source.url} target="_blank" rel="noreferrer">Open schedule in Google Sheets</a>}
        <button type="button" onClick={syncSchedule} disabled={syncing || !source.configured || !source.credentialsConfigured}>
          {syncing ? "Syncing schedule…" : "Sync schedule"}
        </button>
      </div>
    </section>}
    {loadError && <p role="alert">{loadError}</p>}
    {syncError && <div className={styles.error} role="alert"><p>{syncError}</p>
      {diagnostics.length > 0 && <>
        <p>{diagnostics.length} {diagnostics.length === 1 ? "issue needs" : "issues need"} correction in the sheet{diagnostics.length > 10 ? ". Showing the first 10." : "."}</p>
        <ul>{diagnostics.slice(0, 10).map((text, index) => <li key={index}>{text}</li>)}</ul>
        {diagnostics.length > 10 && <details className={styles.moreDiagnostics}>
          <summary>Show {diagnostics.length - 10} more {diagnostics.length === 11 ? "issue" : "issues"}</summary>
          <ul>{diagnostics.slice(10).map((text, index) => <li key={index}>{text}</li>)}</ul>
        </details>}
      </>}
    </div>}
    {(!loadError || sheetsMode) && <>
      <p role="status" aria-live="polite" className={styles.message}>{message}</p>
      <div className={styles.layout}>
        <section className={styles.list} aria-label="Schedule classes">
          <label>Search classes<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label>Filter by day<select value={day} onChange={(event) => setDay(event.target.value)}>
            <option value="">All days</option>{scheduleDays.map((day) => <option key={day}>{day}</option>)}
          </select></label>
          <p className={styles.count}>{filtered.length} classes</p>
          <div className={styles.sessions}>
            {filtered.map((session) => <button type="button" key={session.id} aria-pressed={selected === session.id}
              aria-label={`${sheetsMode ? "View" : "Edit"} ${session.title}, ${session.day} ${session.start}`}
              onClick={() => { setSelected(session.id); setMessage(""); }}>
              <span>{session.day} · {session.start}–{session.end}</span><strong>{session.title}</strong>
              <span>{session.teachers}</span>{!sheetsMode && session.version > 0 && <small>Edited</small>}
              {session.bookable === false && <small>Not bookable</small>}
            </button>)}
            {!filtered.length && <p>{sheetsMode && !sessions.length ? "No published classes yet." : "No classes match your search."}</p>}
          </div>
        </section>
        {active ? sheetsMode ? <ClassPreview session={active} /> : <ClassEditor key={`${active.id}-${active.version}`} session={active}
          onSave={(schedule) => { setSessions(schedule); setMessage("Class saved. The registration form now shows these details."); }} />
          : sheetsMode && <section className={styles.preview}><h2>Published schedule</h2><p>Published classes will appear here after the first successful sync.</p></section>}
      </div>
    </>}
  </main>;
}

export async function getServerSideProps({ req, res }) {
  const redirect = adminPageRedirect(req, res);
  if (redirect) return redirect;
  try {
    const { registrationStore: store } = await import("../../db/reg2026");
    const { getScheduleAdminState } = await import("../../lib/reg2026/google-sheets");
    const { schedule, source } = await getScheduleAdminState(store);
    return { props: { initial: schedule, source, loadError: null } };
  } catch {
    return { props: { initial: null, loadError: "Schedule is temporarily unavailable. Please try again." } };
  }
}
