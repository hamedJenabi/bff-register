import { competitions } from "../../lib/reg2026/catalog";

export function CompetitionSection({ draft, saved, wantsCompetition, setWantsCompetition, change, remaining, error, disabled }) {
  const toggle = (id) => change({ ...draft, competitions: draft.competitions.includes(id)
    ? draft.competitions.filter((value) => value !== id) : [...draft.competitions, id] });
  return <section aria-labelledby="competition-title">
    <h2 id="competition-title">Competition registration</h2>
    <p>Competition entries are separate from competition classes. Each entry costs €10, including for Full Pass participants.</p>
    <fieldset disabled={disabled}>
      <legend>Do you want to compete?</legend>
      {[true, false].map((yes) => <label key={String(yes)}><input type="radio" name="compete" checked={wantsCompetition === yes}
        disabled={!yes && saved.competitions.length > 0} onChange={() => {
          setWantsCompetition(yes);
          if (!yes) change({ ...draft, competitions: [], competitionRoles: {} });
        }} />{yes ? "Yes" : "No"}</label>)}
    </fieldset>
    {wantsCompetition && <fieldset disabled={disabled}>
      <legend>Choose your competitions</legend>
      {competitions.map((competition) => {
        const paid = saved.competitions.includes(competition.id);
        const selected = draft.competitions.includes(competition.id);
        const full = competition.id === "solo_battle" && remaining <= 0 && !paid;
        return <div key={competition.id}>
          <label><input type="checkbox" checked={selected} disabled={paid || full}
            onChange={() => toggle(competition.id)} />{competition.label} · €10{paid ? " · Already booked" : full ? " · Full" : ""}</label>
          {selected && competition.roleRequired && <fieldset disabled={paid}>
            <legend>Dance role for {competition.label}</legend>
            {["lead", "follow"].map((role) => <label key={role}><input type="radio" name={`competition-${competition.id}`}
              checked={draft.competitionRoles[competition.id] === role} onChange={() => change({ ...draft,
                competitionRoles: { ...draft.competitionRoles, [competition.id]: role } })} />{role === "lead" ? "Lead" : "Follow"}</label>)}
          </fieldset>}
        </div>;
      })}
    </fieldset>}
    {saved.competitions.length > 0 && <p>Contact the organizers to change or remove an already booked competition.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export function LunchSection({ draft, saved, change, error, disabled }) {
  return <section aria-labelledby="lunch-title">
    <h2 id="lunch-title">Lunch at the venue</h2>
    <p>€15 per meal: main course, dessert and one drink. Vegan, vegetarian and gluten-free options are available.</p>
    <fieldset disabled={disabled}>
      <legend>Choose Saturday, Sunday, both, or neither</legend>
      {["saturday", "sunday"].map((day) => <label key={day}><input type="checkbox" checked={draft.lunch.includes(day)}
        disabled={saved.lunch.includes(day)} onChange={() => change({ ...draft, lunch: draft.lunch.includes(day)
          ? draft.lunch.filter((value) => value !== day) : [...draft.lunch, day] })} />
        {day === "saturday" ? "Saturday" : "Sunday"} lunch · €15{saved.lunch.includes(day) ? " · Already booked" : ""}</label>)}
    </fieldset>
    {saved.lunch.length > 0 && <p>Contact the organizers to remove a paid lunch booking.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
