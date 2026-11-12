import { COMPETITION_PRICE_CENTS, LUNCH_PRICE_CENTS, FREE_PASS_VOUCHER } from "./catalog";

export const priceDraft = (draft, saved) => {
  const errors = {};
  for (const field of ["competitions", "lunch"]) {
    if (saved[field].some((value) => !draft[field].includes(value))) {
      errors[field] = "Contact the organizers to remove paid add-ons or request a refund.";
    }
  }
  for (const [id, role] of Object.entries(saved.competitionRoles)) {
    if (saved.competitions.includes(id) && role && draft.competitionRoles[id] !== role) {
      errors.competitions = "Contact the organizers to change a paid competition role.";
    }
  }
  const addedCompetitions = draft.competitions.filter((id) => !saved.competitions.includes(id));
  const addedLunch = draft.lunch.filter((day) => !saved.lunch.includes(day));
  if (draft.voucher && draft.voucher !== FREE_PASS_VOUCHER) errors.voucher = "Voucher code not recognized.";
  const subtotalCents = draft.voucher === FREE_PASS_VOUCHER ? 0 : addedCompetitions.length * COMPETITION_PRICE_CENTS + addedLunch.length * LUNCH_PRICE_CENTS;
  const totalCents = subtotalCents === 0 ? 0 : Math.round((subtotalCents + 25) / (1 - 0.014));
  return { errors, subtotalCents, feeCents: totalCents - subtotalCents, totalCents };
};
