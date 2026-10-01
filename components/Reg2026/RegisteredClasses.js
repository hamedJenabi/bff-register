import { useEffect, useState } from "react";
import { useDialogState, Dialog, DialogBackdrop, DialogDisclosure } from "reakit/Dialog";
import {
  unstable_useFormState as useFormState, unstable_Form as Form,
  unstable_FormInput as FormInput, unstable_FormLabel as FormLabel,
  unstable_FormMessage as FormMessage, unstable_FormSubmitButton as FormSubmitButton,
} from "reakit/Form";
import { schedule as mockSchedule, CLASS_SELECTION_LIMIT } from "../../lib/reg2026/catalog";
import { indexSchedule } from "../../lib/reg2026/schedule";
import { parseThemeClass } from "../../lib/reg2026/serialization";
import { validateDraft } from "../../lib/reg2026/validation";
import styles from "./RegisteredClasses.module.scss";

const readableClasses = (value) => parseThemeClass(value).filter((choice) => typeof choice?.sessionId === "string");

export default function RegisteredClasses({ id, firstname, lastname, themeClass, buttonClassName }) {
  const dialog = useDialogState({ baseId: `registered-classes-${id}`, animated: true });
  const [hasOpened, setHasOpened] = useState(false);
  const [schedule, setSchedule] = useState(mockSchedule);
  const scheduleById = indexSchedule(schedule);
  const [savedClasses, setSavedClasses] = useState(() => readableClasses(themeClass));
  const [version, setVersion] = useState(themeClass || "");
  const [availability, setAvailability] = useState({});
  const [editable, setEditable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { setAnimated, stopAnimation } = dialog;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setAnimated(!preference.matches); stopAnimation(); };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [setAnimated, stopAnimation]);
  useEffect(() => { setSavedClasses(readableClasses(themeClass)); setVersion(themeClass || ""); }, [themeClass]);

  const editor = useFormState({
    baseId: `registered-classes-editor-${id}`, resetOnUnmount: false,
    values: { classes: savedClasses, newClass: "", newRole: "", formError: "" },
    onValidate: ({ classes }) => {
      const result = validateDraft({ classes, competitions: [], competitionRoles: {}, lunch: [] }, { ticket: "fullpass" }, schedule);
      if (!result.valid) throw { formError: result.errors.classes || result.errors.form };
    },
    onSubmit: async ({ classes }) => {
      try {
        const response = await fetch("/api/reg2026/admin-classes", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, classes, version }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.errors?.classes || result.error || "Could not save classes.");
        setSavedClasses(result.classes); setVersion(result.version); setAvailability(result.availability);
        setEditing(false); setMessage("Classes updated.");
      } catch (error) { throw { formError: error.message || "Could not save classes." }; }
    },
  });
  const busy = loading || editor.submitting;
  const selections = editing ? editor.values.classes : savedClasses;
  const name = [firstname, lastname].filter(Boolean).join(" ") || `Participant ${id}`;
  const titleId = `registered-classes-title-${id}`;
  const summaryId = `registered-classes-summary-${id}`;
  const chosen = scheduleById[editor.values.newClass];
  const places = (session, role) => availability[session.id]?.[role]?.remaining || 0;
  const optionBlocked = (session) => editor.values.classes.some((choice) => scheduleById[choice.sessionId]?.slotId === session.slotId)
    || (session.partnerClass ? places(session, "lead") + places(session, "follow") : places(session, "total")) <= 0;
  const canAdd = chosen && !optionBlocked(chosen) && editor.values.classes.length < CLASS_SELECTION_LIMIT
    && (!chosen.partnerClass || (["lead", "follow"].includes(editor.values.newRole) && places(chosen, editor.values.newRole) > 0));
  const open = async () => {
    setHasOpened(true); setEditing(false); setMessage(""); setLoading(true); setEditable(false);
    try {
      const response = await fetch(`/api/reg2026/admin-classes?id=${id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load classes.");
      setSavedClasses(result.classes); setVersion(result.version); setAvailability(result.availability); setEditable(result.editable);
      setSchedule(result.schedule);
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  };
  const startEditing = () => { editor.reset(); editor.update("classes", savedClasses); setEditing(true); setMessage(""); };
  const add = () => {
    if (!canAdd) return;
    editor.update("classes", [...editor.values.classes, { sessionId: chosen.id, ...(chosen.partnerClass ? { role: editor.values.newRole } : {}) }]);
    editor.update("newClass", ""); editor.update("newRole", "");
  };

  return (
    <>
      <DialogDisclosure {...dialog} className={buttonClassName} onClick={open} aria-label={`View registered classes for ${name} (ID ${id})`}>
        View ({savedClasses.length})
      </DialogDisclosure>
      {/* Mount the portal after the first click, then retain it for focus restoration. */}
      {hasOpened && <DialogBackdrop {...dialog} className={styles.backdrop} data-animated={String(dialog.animated)}>
        <Dialog {...dialog} className={styles.dialog} data-animated={String(dialog.animated)} aria-labelledby={titleId} aria-describedby={summaryId}>
          <header className={styles.header}>
            <div><h2 id={titleId}>Registered classes</h2><p>{name} · ID {id}</p></div>
            <button type="button" disabled={editor.submitting} onClick={dialog.hide} className={styles.close} aria-label="Close registered classes">×</button>
          </header>
          <p id={summaryId} className={styles.summary}>
            {selections.length ? `${selections.length} ${selections.length === 1 ? "class" : "classes"} ${editing ? "selected" : "registered"}.` : "No classes registered."}
          </p>
          {selections.length > 0 && <ul className={styles.classes}>
            {selections.map((choice, index) => {
              const session = scheduleById[choice.sessionId];
              return <li key={`${choice.sessionId}-${index}`}>
                {session ? <>
                  <p className={styles.time}>{session.day} · {session.start}–{session.end}</p>
                  <h3>{session.title}</h3><p>{session.teachers}</p>
                  <span className={styles.role}>{session.partnerClass ? choice.role === "lead" ? "Lead" : choice.role === "follow" ? "Follow" : "Role not recorded" : "Solo"}</span>
                </> : <p>Class no longer in the schedule: {choice.sessionId}</p>}
                {editing && <button type="button" className={styles.remove} disabled={busy}
                  aria-label={`Remove ${session?.title || choice.sessionId}, ${session?.day || ""} ${session?.start || ""}`}
                  onClick={() => editor.update("classes", selections.filter((_, position) => position !== index))}>Remove</button>}
              </li>;
            })}
          </ul>}
          {editing ? <Form {...editor} className={styles.editor} aria-busy={busy}>
            <p>Choose up to {CLASS_SELECTION_LIMIT} classes, one per time slot. Remove a class to replace it. No email is sent.</p>
            <FormLabel {...editor} name="newClass">Add a class</FormLabel>
            <FormInput {...editor} name="newClass" as="select" disabled={busy || selections.length >= CLASS_SELECTION_LIMIT}
              onChange={() => editor.update("newRole", "")}>
              <option value="">Choose a class</option>
              {schedule.map((session) => <option key={session.id} value={session.id} disabled={optionBlocked(session)}>
                {session.day} {session.start} · {session.title} · {session.teachers}
              </option>)}
            </FormInput>
            {chosen?.partnerClass && <>
              <FormLabel {...editor} name="newRole">Dance role</FormLabel>
              <FormInput {...editor} name="newRole" as="select" disabled={busy}>
                <option value="">Choose a role</option>
                {["lead", "follow"].map((role) => <option key={role} value={role} disabled={places(chosen, role) <= 0}>
                  {role === "lead" ? "Lead" : "Follow"} · {places(chosen, role)} places
                </option>)}
              </FormInput>
            </>}
            <button type="button" className={styles.action} disabled={busy || !canAdd} onClick={add}>Add class</button>
            <FormMessage {...editor} name="formError" />
            <div className={styles.actions}>
              <FormSubmitButton {...editor} className={styles.action} disabled={busy}>{editor.submitting ? "Saving…" : "Save changes"}</FormSubmitButton>
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => setEditing(false)}>Cancel edits</button>
            </div>
          </Form> : <button type="button" className={styles.action} disabled={busy || !editable} onClick={startEditing}>Edit classes</button>}
          {!editing && !loading && !editable && !message && <p className={styles.summary}>Class editing is available for confirmed Full/Parent passes after checkout is finished.</p>}
          <p className={styles.message} role="status" aria-live="polite">{loading ? "Loading current choices…" : message}</p>
        </Dialog>
      </DialogBackdrop>}
    </>
  );
}
