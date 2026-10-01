import { useEffect, useState } from "react";
import { useDialogState, Dialog, DialogBackdrop, DialogDisclosure } from "reakit/Dialog";
import { scheduleById } from "../../lib/reg2026/catalog";
import { parseThemeClass } from "../../lib/reg2026/serialization";
import styles from "./RegisteredClasses.module.scss";

export default function RegisteredClasses({ id, firstname, lastname, themeClass, buttonClassName }) {
  const dialog = useDialogState({ baseId: `registered-classes-${id}`, animated: true });
  const [hasOpened, setHasOpened] = useState(false);
  const { setAnimated, stopAnimation } = dialog;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setAnimated(!preference.matches); stopAnimation(); };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [setAnimated, stopAnimation]);

  const selections = parseThemeClass(themeClass).filter((choice) => typeof choice?.sessionId === "string");
  const name = [firstname, lastname].filter(Boolean).join(" ") || `Participant ${id}`;
  const titleId = `registered-classes-title-${id}`;
  const summaryId = `registered-classes-summary-${id}`;

  return (
    <>
      <DialogDisclosure {...dialog} className={buttonClassName} onClick={() => setHasOpened(true)} aria-label={`View registered classes for ${name} (ID ${id})`}>
        View ({selections.length})
      </DialogDisclosure>
      {/* Mount the portal after the first click, then retain it for focus restoration. */}
      {hasOpened && <DialogBackdrop {...dialog} className={styles.backdrop} data-animated={String(dialog.animated)}>
        <Dialog {...dialog} className={styles.dialog} data-animated={String(dialog.animated)} aria-labelledby={titleId} aria-describedby={summaryId}>
          <header className={styles.header}>
            <div>
              <h2 id={titleId}>Registered classes</h2>
              <p>{name} · ID {id}</p>
            </div>
            <button type="button" onClick={dialog.hide} className={styles.close} aria-label="Close registered classes">×</button>
          </header>
          <p id={summaryId} className={styles.summary}>
            {selections.length ? `${selections.length} ${selections.length === 1 ? "class" : "classes"} registered.` : "No classes registered."}
          </p>
          {selections.length > 0 && (
            <ul className={styles.classes}>
              {selections.map((choice, index) => {
                const session = scheduleById[choice.sessionId];
                return (
                  <li key={`${choice.sessionId}-${index}`}>
                    {session ? (
                      <>
                        <p className={styles.time}>{session.day} · {session.start}–{session.end}</p>
                        <h3>{session.title}</h3>
                        <p>{session.teachers}</p>
                        <span className={styles.role}>
                          {session.partnerClass ? choice.role === "lead" ? "Lead" : choice.role === "follow" ? "Follow" : "Role not recorded" : "Solo"}
                        </span>
                      </>
                    ) : <p>Class no longer in the schedule: {choice.sessionId}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Dialog>
      </DialogBackdrop>}
    </>
  );
}
