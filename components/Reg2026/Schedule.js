import { useRef, useState } from "react";
import { useDialogState, Dialog, DialogBackdrop } from "reakit/Dialog";
import { schedule, scheduleDays, scheduleById, CLASS_DAILY_LIMIT } from "../../lib/reg2026/catalog";
import { validateDraft } from "../../lib/reg2026/validation";
import styles from "./Registration.module.scss";

export default function Schedule({ participant, draft, change, availability, error, reportError, disabled }) {
  const dialog = useDialogState();
  const finalFocusRef = useRef(null);
  const [active, setActive] = useState(null);
  const [role, setRole] = useState("");
  const [modalError, setModalError] = useState("");
  const selected = (id) => draft.classes.find((selection) => selection.sessionId === id);
  const places = (session, pool) => availability[session.id]?.[pool]?.remaining || 0;
  const full = (session) => session.partnerClass ? places(session, "lead") + places(session, "follow") <= 0 : places(session, "total") <= 0;
  const open = (session, event) => {
    finalFocusRef.current = event.currentTarget;
    setActive(session); setRole(selected(session.id)?.role || ""); setModalError(""); dialog.show();
  };
  const select = () => {
    const classes = [...draft.classes.filter((selection) => selection.sessionId !== active.id),
      { sessionId: active.id, ...(active.partnerClass ? { role } : {}) }];
    const next = { ...draft, classes };
    const result = validateDraft(next, participant);
    if (result.errors.classes || result.errors.form) { setModalError(result.errors.classes || result.errors.form); return; }
    if (places(active, active.partnerClass ? role : "total") <= 0) { setModalError("This place is full. Choose another class or role."); return; }
    change(next); reportError(""); dialog.hide();
  };
  const remove = (id) => { change({ ...draft, classes: draft.classes.filter((s) => s.sessionId !== id) }); reportError(""); };
  return <section aria-labelledby="schedule-title">
    <h2 id="schedule-title">Your class schedule</h2>
    <p>Choose up to {CLASS_DAILY_LIMIT} classes each day, with one per time slot. Every session is independent. Draft choices reserve no places until you submit.</p>
    {error && <p role="alert">{error}</p>}
    {scheduleDays.map((day) => {
      const sessions = schedule.filter((session) => session.day === day);
      const rooms = [...new Set(sessions.map((session) => session.room))];
      const times = [...new Set(sessions.map((session) => session.start))];
      return <div className={styles.day} key={day}>
        <h3>{day} <span>{draft.classes.filter((s) => scheduleById[s.sessionId]?.day === day).length} selected</span></h3>
        <div className={styles.tableScroll}><table className={styles.schedule}>
          <caption className={styles.srOnly}>{day} classes by time and room</caption>
          <thead><tr><th scope="col">Time</th>{rooms.map((room) => <th scope="col" key={room}>{room}</th>)}</tr></thead>
          <tbody>{times.map((time) => <tr key={time}>
            <th scope="row">{time}–{sessions.find((s) => s.start === time).end}</th>
            {rooms.map((room) => {
              const session = sessions.find((s) => s.room === room && s.start === time);
              if (!session) return <td className={styles.emptyCell} key={room}><span className={styles.srOnly}>No class</span></td>;
              const choice = selected(session.id);
              return <td key={room}><button type="button" className={styles.classCard} aria-pressed={!!choice}
                disabled={disabled || (full(session) && !choice)} onClick={(event) => open(session, event)}>
                <small className={styles.mobileRoom}>{room}</small><strong>{session.title}</strong><span>{session.teachers}</span>
                <small>{choice ? `Selected${choice.role ? ` · ${choice.role}` : ""}` : full(session) ? "Full" : session.partnerClass
                  ? `${places(session, "lead")} lead · ${places(session, "follow")} follow` : `${places(session, "total")} places`}</small>
              </button></td>;
            })}
          </tr>)}</tbody>
        </table></div>
      </div>;
    })}
    <div className={styles.selectedClasses}><h3>Selected classes</h3>
      {draft.classes.length === 0 ? <p>No classes selected.</p> : <ul>{draft.classes.map((choice) => {
        const session = scheduleById[choice.sessionId];
        return session && <li key={choice.sessionId}><span>{session.day}, {session.start} · {session.title} · {session.room}{choice.role ? ` · ${choice.role}` : ""}</span>
          <button type="button" disabled={disabled} onClick={() => remove(choice.sessionId)} aria-label={`Remove ${session.title}, ${session.day} ${session.start}`}>Remove</button></li>;
      })}</ul>}
    </div>
    {active && <DialogBackdrop {...dialog} className={styles.backdrop}>
      <Dialog {...dialog} className={styles.dialog} unstable_finalFocusRef={finalFocusRef} aria-labelledby="class-detail-title" aria-describedby="class-detail-description">
        {active && <>
          <button type="button" className={styles.close} onClick={dialog.hide} aria-label="Close class details">×</button>
          <p>{active.day} · {active.start}–{active.end} · {active.room}</p>
          <h2 id="class-detail-title">{active.title}</h2><p>{active.teachers}</p>
          <p id="class-detail-description">{active.description}</p>
          {active.partnerClass && <fieldset><legend>Choose your dance role</legend>{["lead", "follow"].map((value) =>
            <label key={value}><input type="radio" name="class-role" value={value} checked={role === value}
              disabled={places(active, value) <= 0 && selected(active.id)?.role !== value} onChange={() => setRole(value)} />
              {value === "lead" ? "Lead" : "Follow"} · {places(active, value)} places</label>)}</fieldset>}
          {modalError && <p role="alert">{modalError}</p>}
          <button type="button" className={styles.primary} onClick={select}>{selected(active.id) ? "Update class choice" : "Select this class"}</button>
          {selected(active.id) && <button type="button" onClick={() => { remove(active.id); dialog.hide(); }}>Remove class</button>}
        </>}
      </Dialog>
    </DialogBackdrop>}
  </section>;
}
