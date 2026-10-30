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
import { scheduleDays, CLASS_SELECTION_LIMIT } from "../../lib/reg2026/catalog";
import { indexSchedule, remainingPlaces, sessionsOverlap } from "../../lib/reg2026/schedule";
import { validateDraft } from "../../lib/reg2026/validation";
import { CLASS_ROLES, CLASS_ROLE_LABELS } from "../../lib/reg2026/capacity";
import SwitchRoleNotice from "./SwitchRoleNotice";
import styles from "./Registration.module.scss";

export default function Schedule({ participant, form, availability, disabled, sessions = [] }) {
  const schedule = sessions;
  const scheduleById = indexSchedule(schedule);
  const draft = registrationDraft(form.values);
  const limitReached = draft.classes.length >= CLASS_SELECTION_LIMIT;
  const dialog = useDialogState({ baseId: "reg2026-class-dialog", animated: true });
  const switchDialog = useDialogState({ baseId: "reg2026-switch-dialog" });
  const { setAnimated, stopAnimation } = dialog;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setAnimated(!preference.matches); stopAnimation(); };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [setAnimated, stopAnimation]);
  const finalFocusRef = useRef(null);
  const switchFocusRef = useRef(null);
  const [active, setActive] = useState(null);
  const selection = (role) => [...draft.classes.filter((choice) => choice.sessionId !== active.id),
    { sessionId: active.id, ...(active.partnerClass ? { role } : {}) }];
  const classForm = useFormState({
    baseId: "reg2026-class-form",
    resetOnUnmount: false,
    values: { role: "", selectionError: "" },
    onValidate: ({ role }) => {
      if (!active) return;
      if (active.partnerClass && !CLASS_ROLES.includes(role)) {
        throw { role: "Choose lead, follow or switch for this class." };
      }
      const result = validateDraft({ ...draft, classes: selection(role) }, participant, schedule);
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
  const places = (session, pool) => remainingPlaces(availability[session.id]?.[pool]);
  const full = (session) => places(session, "total") <= 0;
  const open = (session, event) => {
    finalFocusRef.current = event.currentTarget;
    classForm.reset();
    classForm.update("role", selected(session.id)?.role || "");
    setActive(session); dialog.show();
  };
  const remove = (id) => form.update("classes", draft.classes.filter((choice) => choice.sessionId !== id));
  return <section aria-labelledby="schedule-title">
    <h2 id="schedule-title">Your class schedule</h2>
    <p>Choose up to {CLASS_SELECTION_LIMIT} classes in total across the festival, with one per time slot. Every session is independent. Draft choices reserve no places until you submit.</p>
    <FormMessage {...form} name="classes" />
    {scheduleDays.map((day) => {
      const sessions = schedule.filter((session) => session.day === day && session.bookable !== false);
      const times = [...new Set(sessions.map((session) => session.start))];
      const dayHeadingId = `reg2026-day-${day.toLowerCase()}`;
      return <div className={styles.day} key={day} role="group" aria-labelledby={dayHeadingId}>
        <h3 id={dayHeadingId}>{day}</h3>
        {times.map((time) => {
          const slot = sessions.filter((session) => session.start === time);
          const sharedEnd = slot.every((session) => session.end === slot[0].end);
          return <div className={styles.timeSlot} key={time}>
            <h4>{time}{sharedEnd ? `–${slot[0].end}` : ""}</h4>
            <div className={styles.classGrid}>
              {slot.map((session) => {
                const choice = selected(session.id);
                const conflict = draft.classes.some((selection) => sessionsOverlap(session, scheduleById[selection.sessionId]));
                const blocked = (conflict || limitReached) && !choice;
                const status = choice ? `Selected${choice.role ? ` · ${choice.role}` : ""}`
                  : limitReached ? `${CLASS_SELECTION_LIMIT}-class limit reached`
                    : blocked ? "Another class selected in this slot" : full(session) ? "Sold out"
                      : session.partnerClass && places(session, "follow") <= 0 ? "Sold out for followers" : null;
                return <button key={session.id} type="button" className={styles.classCard} aria-pressed={!!choice}
                  data-blocked={blocked || undefined}
                  disabled={disabled || blocked || (full(session) && !choice)} onClick={(event) => open(session, event)}>
                  <strong>{session.title}</strong><span>{session.teachers}</span>
                  {session.levels && <span>Levels: {Array.isArray(session.levels) ? session.levels.join(", ") : session.levels}</span>}
                  {!sharedEnd && <span>{session.start}–{session.end}</span>}
                  {status && <small>{status}</small>}
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
          <p>{active.day}{active.date ? ` · ${active.date}` : ""} · {active.start}–{active.end}</p>
          <h2 id="class-detail-title">{active.title}</h2><p>{active.teachers}</p>
          {active.levels && <p>Levels: {Array.isArray(active.levels) ? active.levels.join(", ") : active.levels}</p>}
          <p id="class-detail-description">{active.description}</p>
          <Form {...classForm} onSubmit={(event) => event.stopPropagation()}>
            {active.partnerClass && <>
              <FormRadioGroup {...classForm} name="role">
                <FormLabel {...classForm} name="role" as="legend">Choose your dance role</FormLabel>
                {CLASS_ROLES.map((value) => <label key={value}>
                  <FormRadio {...classForm} name="role" value={value} id={`reg2026-class-role-${value}`}
                    ref={value === "switch" ? switchFocusRef : undefined}
                    disabled={places(active, value) <= 0 && selected(active.id)?.role !== value}
                    onChange={(event) => { if (value === "switch" && event.currentTarget.checked) switchDialog.show(); }} />
                  {CLASS_ROLE_LABELS[value]}{places(active, value) <= 0 ? " · Sold out" : ""}
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
          <SwitchRoleNotice dialog={switchDialog} finalFocusRef={switchFocusRef} />
        </>}
      </Dialog>
    </DialogBackdrop>}
  </section>;
}
