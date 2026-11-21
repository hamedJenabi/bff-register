import { competitions, isClassPass, scheduleDays } from "../../lib/reg2026/catalog";
import { CLASS_ROLE_LABELS } from "../../lib/reg2026/capacity";
import { indexSchedule } from "../../lib/reg2026/schedule";
import styles from "./Registration.module.scss";

const competitionById = Object.fromEntries(competitions.map((entry) => [entry.id, entry]));
const dayLabel = (day) => day.charAt(0).toUpperCase() + day.slice(1);

export default function RegistrationSummary({ choices, sessions, ticket }) {
  const byId = indexSchedule(sessions);
  const classes = [...choices.classes].sort((left, right) => {
    const a = byId[left.sessionId], b = byId[right.sessionId];
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    return scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day) || a.start.localeCompare(b.start);
  });

  return <>
    {(isClassPass(ticket) || classes.length > 0) && (
      <section aria-labelledby="registered-classes-title">
        <h2 id="registered-classes-title">Your registered classes</h2>
        {classes.length ? <ul className={styles.savedChoices}>
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
        </ul> : <p>No classes registered.</p>}
      </section>
    )}
    <section className={styles.competitionSection} aria-labelledby="registered-competitions-title">
      <h2 id="registered-competitions-title">Your competitions</h2>
      {choices.competitions.length ? <ul className={styles.savedChoices}>
        {choices.competitions.map((id) => <li key={id}>
          <h3>{competitionById[id]?.label || id}</h3>
          {choices.competitionRoles[id] && <p>Dance role: {CLASS_ROLE_LABELS[choices.competitionRoles[id]] || choices.competitionRoles[id]}</p>}
        </li>)}
      </ul> : <p>No competitions registered.</p>}
    </section>
    <section className={styles.lunchSection} aria-labelledby="registered-lunch-title">
      <h2 id="registered-lunch-title">Your lunch bookings</h2>
      {choices.lunch.length ? <ul className={styles.savedChoices}>
        {choices.lunch.map((day) => <li key={day}>{dayLabel(day)} lunch</li>)}
      </ul> : <p>No lunch booked.</p>}
    </section>
  </>;
}
