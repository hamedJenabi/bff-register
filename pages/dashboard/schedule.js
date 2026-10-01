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

export default function ScheduleAdmin({ initial, loadError }) {
  const [sessions, setSessions] = useState(initial || []);
  const [selected, setSelected] = useState(initial?.[0]?.id || "");
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [message, setMessage] = useState("");
  const active = sessions.find((session) => session.id === selected);
  const filtered = sessions.filter((session) => (!day || session.day === day) &&
    [session.title, session.teachers].some((text) => text.toLowerCase().includes(query.trim().toLowerCase())));
  return <main className={styles.page}>
    <Head><title>Schedule · Blues Fever dashboard</title><meta name="robots" content="noindex,nofollow" /></Head>
    <nav className={styles.navigation} aria-label="Dashboard pages">
      <Link href="/dashboard/admin">Registrations</Link><Link href="/dashboard/schedule" aria-current="page">Schedule</Link>
    </nav>
    <header className={styles.header}><h1>Schedule</h1><p>Edit class details for the registration form. Mock classes appear until you save changes.</p></header>
    {loadError ? <p role="alert">{loadError}</p> : <>
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
              aria-label={`Edit ${session.title}, ${session.day} ${session.start}`}
              onClick={() => { setSelected(session.id); setMessage(""); }}>
              <span>{session.day} · {session.start}–{session.end}</span><strong>{session.title}</strong>
              <span>{session.teachers}</span>{session.version > 0 && <small>Edited</small>}
            </button>)}
            {!filtered.length && <p>No classes match your search.</p>}
          </div>
        </section>
        {active && <ClassEditor key={`${active.id}-${active.version}`} session={active}
          onSave={(schedule) => { setSessions(schedule); setMessage("Class saved. The registration form now shows these details."); }} />}
      </div>
    </>}
  </main>;
}

export async function getServerSideProps({ req, res }) {
  const redirect = adminPageRedirect(req, res);
  if (redirect) return redirect;
  try {
    const { registrationStore: store } = await import("../../db/reg2026");
    return { props: { initial: await store.schedule(), loadError: null } };
  } catch {
    return { props: { initial: null, loadError: "Schedule is temporarily unavailable. Please try again." } };
  }
}
