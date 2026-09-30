import {
  unstable_FormCheckbox as FormCheckbox,
  unstable_FormLabel as FormLabel,
  unstable_FormMessage as FormMessage,
  unstable_FormRadio as FormRadio,
  unstable_FormRadioGroup as FormRadioGroup,
} from "reakit/Form";
import { competitions } from "../../lib/reg2026/catalog";
import { emptyCompetitionRoles } from "../../lib/reg2026/form";

export function CompetitionSection({ form, saved, remaining, disabled }) {
  return (
    <section aria-labelledby="competition-title">
      <h2 id="competition-title">Competition registration</h2>
      <p>Competition entries are separate from competition classes. Each entry costs €10.</p>
      <FormRadioGroup {...form} name="compete" disabled={disabled}>
        <FormLabel {...form} name="compete" as="legend">Do you want to compete?</FormLabel>
        {["yes", "no"].map((value) => (
          <label key={value}>
            <FormRadio {...form} name="compete" value={value} id={`reg2026-compete-${value}`}
              disabled={disabled || (value === "no" && saved.competitions.length > 0)}
              onChange={() => {
                if (value === "no") {
                  form.update("competitions", []);
                  form.update("competitionRoles", emptyCompetitionRoles());
                }
              }} />
            {value === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </FormRadioGroup>
      <FormMessage {...form} name="compete" />
      {form.values.compete === "yes" && (
        <fieldset disabled={disabled}>
          <legend>Choose your competitions</legend>
          {competitions.map((competition) => {
            const paid = saved.competitions.includes(competition.id);
            const selected = form.values.competitions.includes(competition.id);
            const full = competition.id === "solo_battle" && remaining <= 0 && !paid;
            const roleName = ["competitionRoles", competition.id];
            return (
              <div key={competition.id}>
                <label>
                  <FormCheckbox {...form} name="competitions" value={competition.id} disabled={disabled || paid || full} />
                  {competition.label} · €10{paid ? " · Already booked" : full ? " · Full" : ""}
                </label>
                {selected && competition.roleRequired && (
                  <>
                    <FormRadioGroup {...form} name={roleName} disabled={disabled || paid}>
                      <FormLabel {...form} name={roleName} as="legend">Dance role for {competition.label}</FormLabel>
                      {["lead", "follow"].map((role) => (
                        <label key={role}>
                          <FormRadio {...form} name={roleName} value={role} id={`reg2026-${competition.id}-${role}`} disabled={disabled || paid} />
                          {role === "lead" ? "Lead" : "Follow"}
                        </label>
                      ))}
                    </FormRadioGroup>
                    <FormMessage {...form} name={roleName} />
                  </>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      {saved.competitions.length > 0 && <p>Contact the organizers to change or remove an already booked competition.</p>}
      <FormMessage {...form} name="competitions" />
    </section>
  );
}

export function LunchSection({ form, saved, disabled }) {
  return (
    <section aria-labelledby="lunch-title">
      <h2 id="lunch-title">Lunch at the venue</h2>
      <p>€15 per meal: main course, dessert and one drink. Vegan, vegetarian and gluten-free options are available.</p>
      <fieldset disabled={disabled}>
        <legend>Choose Saturday, Sunday, both, or neither</legend>
        {["saturday", "sunday"].map((day) => (
          <label key={day}>
            <FormCheckbox {...form} name="lunch" value={day} disabled={disabled || saved.lunch.includes(day)} />
            {day === "saturday" ? "Saturday" : "Sunday"} lunch · €15
            {saved.lunch.includes(day) ? " · Already booked" : ""}
          </label>
        ))}
      </fieldset>
      {saved.lunch.length > 0 && <p>Contact the organizers to remove a paid lunch booking.</p>}
      <FormMessage {...form} name="lunch" />
    </section>
  );
}
