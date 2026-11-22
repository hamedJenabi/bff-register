import { scheduleDays } from "../../lib/reg2026/catalog";
import { CLASS_ROLE_LABELS } from "../../lib/reg2026/capacity";
import { indexSchedule } from "../../lib/reg2026/schedule";
import styles from "./Registration.module.scss";

export default function RegistrationSummary({ choices, sessions }) {
  const byId = indexSchedule(sessions);
  const classes = [...choices.classes].sort((left, right) => {
    const a = byId[left.sessionId], b = byId[right.sessionId];
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    return scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day) || a.start.localeCompare(b.start);
  });

  return (
    <section aria-labelledby="registered-classes-title">
      <h2 id="registered-classes-title">Your registered classes</h2>
      {classes.length ? (
        <ul className={styles.savedChoices}>
          {classes.map((choice) => {
            const session = byId[choice.sessionId];
            return <li key={choice.sessionId}>
              {session ? <>
                <p className={styles.savedDetails}>
                  {session.day}{session.date ? ` · ${session.date}` : ""} · {session.start}–{session.end}
                </p>
                <h3>{session.title}</h3>
                {session.teachers && <p>{session.teachers}</p>}
                {session.room && <p>Room: {session.room}</p>}
              </> : <h3>Class details unavailable ({choice.sessionId})</h3>}
              {choice.role && <p>Dance role: {CLASS_ROLE_LABELS[choice.role] || choice.role}</p>}
            </li>;
          })}
        </ul>
      ) : <p>No classes registered.</p>}
      <p>
        To change a confirmed class, email{" "}
        <a href="mailto:registration@bluesfever.eu">registration@bluesfever.eu</a>.
      </p>
    </section>
  );
}
