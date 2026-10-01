import { competitions } from "./catalog";
import { validateDraft } from "./validation";
import { priceDraft } from "./pricing";

export const emptyCompetitionRoles = () => Object.fromEntries(
  competitions.filter((competition) => competition.roleRequired).map(({ id }) => [id, ""]),
);

// Reakit needs initialized fields, including roles not yet selected in the UI.
export const registrationFormValues = (draft, compete) => ({
  classes: draft?.classes || [],
  competitions: draft?.competitions || [],
  competitionRoles: { ...emptyCompetitionRoles(), ...draft?.competitionRoles },
  lunch: draft?.lunch || [],
  voucher: draft?.voucher || "",
  compete: draft?.competitions?.length ? "yes" : (compete === "yes" ? "yes" : "no"),
  formError: "",
});

// Keep UI-only fields and unselected roles out of saved drafts and API requests.
export const registrationDraft = (values) => {
  const voucher = typeof values.voucher === "string" ? values.voucher.trim() : values.voucher;
  return {
    classes: values.classes,
    competitions: values.competitions,
    competitionRoles: Object.fromEntries(competitions
      .filter(({ id, roleRequired }) => roleRequired && values.competitions.includes(id))
      .map(({ id }) => [id, values.competitionRoles[id]])),
    lunch: values.lunch,
    ...(voucher ? { voucher } : {}),
  };
};

export const registrationFormErrors = (errors = {}) => {
  const { form, ...fields } = errors;
  return { ...fields, ...(form ? { formError: form } : {}) };
};

export const validateRegistrationForm = (values, participant, saved) => {
  const validated = validateDraft(registrationDraft(values), participant);
  const price = priceDraft(validated.value, saved);
  const errors = registrationFormErrors({ ...validated.errors, ...price.errors });
  for (const competition of competitions) {
    if (competition.roleRequired && values.competitions.includes(competition.id) &&
        !["lead", "follow"].includes(values.competitionRoles[competition.id])) {
      errors.competitionRoles = { ...errors.competitionRoles,
        [competition.id]: `Choose lead or follow for ${competition.label}.` };
    }
  }
  return errors;
};
