import { useRef, useState } from "react";
import { useDialogState, Dialog, DialogBackdrop } from "reakit/Dialog";
import {
  unstable_FormCheckbox as FormCheckbox,
  unstable_FormLabel as FormLabel,
  unstable_FormMessage as FormMessage,
  unstable_FormRadio as FormRadio,
  unstable_FormRadioGroup as FormRadioGroup,
} from "reakit/Form";
import { competitions } from "../../lib/reg2026/catalog";
import { emptyCompetitionRoles } from "../../lib/reg2026/form";
import { conflictsWithSolo, SOLO_COMPETITION_NOTICE } from "../../lib/reg2026/competitions";
import { remainingPlaces } from "../../lib/reg2026/schedule";
import styles from "./Registration.module.scss";

export function CompetitionSection({ form, saved, availability, sessions = [], disabled }) {
  const soloDialog = useDialogState({ baseId: "reg2026-solo-conflict-dialog" });
  const [soloDialogMounted, setSoloDialogMounted] = useState(false);
  const soloFocusRef = useRef(null);
  const soloConflict = form.values.competitions.includes("solo_battle") && form.values.classes.some(
    (choice) => conflictsWithSolo(sessions.find((session) => session.id === choice.sessionId)),
  );
  const selectSolo = (event) => {
    if (!event.currentTarget.checked) return;
    const conflictingChoices = form.values.classes.filter(
      (choice) => conflictsWithSolo(sessions.find((session) => session.id === choice.sessionId)),
    );
    if (!conflictingChoices.length) return;
    form.update("classes", form.values.classes.filter((choice) => !conflictingChoices.includes(choice)));
    const session = sessions.find((entry) => entry.id === conflictingChoices[0].sessionId);
    const slot = document.getElementById("reg2026-slot-saturday-1600") ||
      document.getElementById(`reg2026-slot-saturday-${session.start.replace(":", "")}`);
    soloFocusRef.current = slot;
    slot?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setSoloDialogMounted(true);
    soloDialog.show();
  };
  return (
    <section className={styles.competitionSection} aria-labelledby="competition-title">
      <h2 id="competition-title">Competition registration</h2>
      <p className={styles.informationText}>Competition entries are separate from competition classes. Each entry costs €10.</p>
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
            const places = availability[competition.id];
            const pools = competition.roleRequired ? ["lead", "follow"] : ["total"];
            const full = !paid && pools.every((pool) => remainingPlaces(places?.[pool]) <= 0);
            const roleName = ["competitionRoles", competition.id];
            return (
              <div key={competition.id}>
                <label>
                  <FormCheckbox {...form} name="competitions" value={competition.id} disabled={disabled || paid || (full && !selected)}
                    onChange={competition.id === "solo_battle" ? selectSolo : undefined} />
                  {competition.label} · €10{full ? " · Sold out" : ""}
                </label>
                {competition.description && <p className={styles.informationText}>{competition.description}</p>}
                {competition.id === "solo_battle" && (
                  <p className={styles.informationText} role={soloConflict ? "alert" : undefined}>
                    {SOLO_COMPETITION_NOTICE}{soloConflict ? " Remove the conflicting class before submitting." : ""}
                  </p>
                )}
                {competition.roleRequired && !selected && !full && pools.some((pool) => remainingPlaces(places?.[pool]) <= 0) && (
                  <p>{pools.filter((pool) => remainingPlaces(places?.[pool]) <= 0).map((pool) => pool === "lead" ? "Lead" : "Follow").join(" and ")} · Sold out</p>
                )}
                {selected && competition.roleRequired && (
                  <>
                    <FormRadioGroup {...form} name={roleName} disabled={disabled || paid}>
                      <FormLabel {...form} name={roleName} as="legend">Dance role for {competition.label}</FormLabel>
                      {["lead", "follow"].map((role) => {
                        const roleFull = !paid && remainingPlaces(places?.[role]) <= 0;
                        return (
                          <label key={role}>
                            <FormRadio {...form} name={roleName} value={role} id={`reg2026-${competition.id}-${role}`} disabled={disabled || paid || roleFull} />
                            {role === "lead" ? "Lead" : "Follow"}{roleFull ? " · Sold out" : ""}
                          </label>
                        );
                      })}
                    </FormRadioGroup>
                    <FormMessage {...form} name={roleName} />
                  </>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      <FormMessage {...form} name="competitions" />
      {soloDialogMounted && <DialogBackdrop {...soloDialog} className={styles.backdrop} data-animated="false">
        <Dialog {...soloDialog} className={styles.dialog} data-animated="false" unstable_finalFocusRef={soloFocusRef}
          aria-labelledby="solo-conflict-title" aria-describedby="solo-conflict-description">
          <h2 id="solo-conflict-title">Saturday 16:00–17:15 is reserved for Solo competitors</h2>
          <p id="solo-conflict-description" className={styles.informationText}>{SOLO_COMPETITION_NOTICE} Your conflicting class choices have been removed automatically.</p>
          <button type="button" className={styles.primary} onClick={soloDialog.hide}>Got it</button>
        </Dialog>
      </DialogBackdrop>}
    </section>
  );
}

export function LunchSection({ form, saved, disabled }) {
  return (
    <section className={styles.lunchSection} aria-labelledby="lunch-title">
      <h2 id="lunch-title">Lunch at the venue</h2>
      <p>€15 per meal: main course, dessert and one drink. Vegan, vegetarian and gluten-free options are available.</p>
      <fieldset disabled={disabled}>
        <legend>Choose Saturday, Sunday, both, or neither</legend>
        {["saturday", "sunday"].map((day) => (
          <label key={day}>
            <FormCheckbox {...form} name="lunch" value={day} disabled={disabled || saved.lunch.includes(day)} />
            {day === "saturday" ? "Saturday" : "Sunday"} lunch · €15
          </label>
        ))}
      </fieldset>
      <FormMessage {...form} name="lunch" />
    </section>
  );
}
