import { useEffect, useRef, useState } from "react";
import { useDialogState, Dialog, DialogBackdrop } from "reakit/Dialog";
import {
  unstable_useFormState as useFormState,
  unstable_Form as Form,
  unstable_FormLabel as FormLabel,
  unstable_FormMessage as FormMessage,
  unstable_FormRadio as FormRadio,
  unstable_FormRadioGroup as FormRadioGroup,
  unstable_FormSubmitButton as FormSubmitButton,
} from "reakit/Form";
import { registrationDraft } from "../../lib/reg2026/form";
import { schedule, scheduleDays, scheduleById, CLASS_DAILY_LIMIT } from "../../lib/reg2026/catalog";
import { validateDraft } from "../../lib/reg2026/validation";
import styles from "./Registration.module.scss";

export default function Schedule({ participant, form, availability, disabled }) {
  const draft = registrationDraft(form.values);
  const dialog = useDialogState({ baseId: "reg2026-class-dialog", animated: true });
  const { setAnimated, stopAnimation } = dialog;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setAnimated(!preference.matches); stopAnimation(); };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [setAnimated, stopAnimation]);
  const finalFocusRef = useRef(null);
  const [active, setActive] = useState(null);
  const selection = (role) => [...draft.classes.filter((choice) => choice.sessionId !== active.id),
    { sessionId: active.id, ...(active.partnerClass ? { role } : {}) }];
  const classForm = useFormState({
    baseId: "reg2026-class-form",
    resetOnUnmount: false,
    values: { role: "", selectionError: "" },
    onValidate: ({ role }) => {
      if (!active) return;
      if (active.partnerClass && !["lead", "follow"].includes(role)) {
        throw { role: "Choose lead or follow for this class." };
      }
      const result = validateDraft({ ...draft, classes: selection(role) }, participant);
      if (result.errors.classes || result.errors.form) {
        throw { selectionError: result.errors.classes || result.errors.form };
      }
      if (places(active, active.partnerClass ? role : "total") <= 0) {
        throw { selectionError: "This place is full. Choose another class or role." };
      }
    },
    onSubmit: ({ role }) => {
      form.update("classes", selection(role));
      dialog.hide();
    },
  });
  const selected = (id) => draft.classes.find((selection) => selection.sessionId === id);
  const places = (session, pool) => availability[session.id]?.[pool]?.remaining || 0;
  const full = (session) => session.partnerClass ? places(session, "lead") + places(session, "follow") <= 0 : places(session, "total") <= 0;
  const open = (session, event) => {
    finalFocusRef.current = event.currentTarget;
    classForm.reset();
    classForm.update("role", selected(session.id)?.role || "");
    setActive(session); dialog.show();
  };
  const remove = (id) => form.update("classes", draft.classes.filter((choice) => choice.sessionId !== id));
  return <section aria-labelledby="schedule-title">
    <h2 id="schedule-title">Your class schedule</h2>
    <p>Choose up to {CLASS_DAILY_LIMIT} classes each day, with one per time slot. Every session is independent. Draft choices reserve no places until you submit.</p>
    <FormMessage {...form} name="classes" />
    {scheduleDays.map((day) => {
      const sessions = schedule.filter((session) => session.day === day);
      const times = [...new Set(sessions.map((session) => session.start))];
      return <div className={styles.day} key={day}>
        <h3>{day}</h3>
        {times.map((time) => {
          const slot = sessions.filter((session) => session.start === time);
          const occupied = slot.some((session) => selected(session.id));
          return <div className={styles.timeSlot} key={time}>
            <h4>{time}–{slot[0].end}</h4>
            <div className={styles.classGrid}>
              {slot.map((session) => {
                const choice = selected(session.id);
                const blocked = occupied && !choice;
                return <button key={session.id} type="button" className={styles.classCard} aria-pressed={!!choice}
                  data-blocked={blocked || undefined}
                  disabled={disabled || blocked || (full(session) && !choice)} onClick={(event) => open(session, event)}>
                  <strong>{session.title}</strong><span>{session.teachers}</span>
                  <small>{choice ? `Selected${choice.role ? ` · ${choice.role}` : ""}` : blocked ? "Another class selected in this slot" : full(session) ? "Full" : session.partnerClass
                    ? `${places(session, "lead")} lead · ${places(session, "follow")} follow` : `${places(session, "total")} places`}</small>
                </button>;
              })}
            </div>
          </div>;
        })}
      </div>;
    })}
    <div className={styles.selectedClasses}><h3>Selected classes</h3>
      {draft.classes.length === 0 ? <p>No classes selected.</p> : <ul>{draft.classes.map((choice) => {
        const session = scheduleById[choice.sessionId];
        return session && <li key={choice.sessionId}><span>{session.day}, {session.start} · {session.title}{choice.role ? ` · ${choice.role}` : ""}</span>
          <button type="button" disabled={disabled} onClick={() => remove(choice.sessionId)} aria-label={`Remove ${session.title}, ${session.day} ${session.start}`}>Remove</button></li>;
      })}</ul>}
    </div>
    {active && <DialogBackdrop {...dialog} className={styles.backdrop} data-animated={String(dialog.animated)}>
      <Dialog {...dialog} className={styles.dialog} data-animated={String(dialog.animated)} unstable_finalFocusRef={finalFocusRef} aria-labelledby="class-detail-title" aria-describedby="class-detail-description">
        {active && <>
          <button type="button" className={styles.close} onClick={dialog.hide} aria-label="Close class details">×</button>
          <p>{active.day} · {active.start}–{active.end}</p>
          <h2 id="class-detail-title">{active.title}</h2><p>{active.teachers}</p>
          <p id="class-detail-description">{active.description}</p>
          <Form {...classForm} onSubmit={(event) => event.stopPropagation()}>
            {active.partnerClass && <>
              <FormRadioGroup {...classForm} name="role">
                <FormLabel {...classForm} name="role" as="legend">Choose your dance role</FormLabel>
                {["lead", "follow"].map((value) => <label key={value}>
                  <FormRadio {...classForm} name="role" value={value} id={`reg2026-class-role-${value}`}
                    disabled={places(active, value) <= 0 && selected(active.id)?.role !== value} />
                  {value === "lead" ? "Lead" : "Follow"} · {places(active, value)} places
                </label>)}
              </FormRadioGroup>
              <FormMessage {...classForm} name="role" />
            </>}
            <FormMessage {...classForm} name="selectionError" />
            <FormSubmitButton {...classForm} className={styles.primary} disabled={disabled || classForm.submitting}>
              {selected(active.id) ? "Update class choice" : "Select this class"}
            </FormSubmitButton>
            {selected(active.id) && <button type="button" disabled={disabled} onClick={() => { remove(active.id); dialog.hide(); }}>Remove class</button>}
          </Form>
        </>}
      </Dialog>
    </DialogBackdrop>}
  </section>;
}
