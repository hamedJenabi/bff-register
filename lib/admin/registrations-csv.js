const columns = [
  "id", "date", "status", "role", "ticket", "parent_partner", "firstname", "lastname",
  "email", "country", "level", "theme_class", "lunch", "tshirt", "competition",
  "strictly_role", "newcomers_mixnmatch_role", "open_mixnmatch_role", "competitions",
  "price", "to_pay", "donation", "terms",
];

const quoteCell = (value) => {
  const text = String(value ?? "");
  const startsLikeFormula = /^\s*[=+\-@]/.test(text);
  const isSignedNumber = /^[+-]\d+(?:\.\d+)?$/.test(text);
  // Quoting a cell alone does not stop spreadsheets from evaluating it.
  const cell = startsLikeFormula && !isSignedNumber ? `'${text}` : text;
  return `"${cell.replace(/"/g, '""')}"`;
};

export const registrationsCsv = (registrations) => {
  const rows = [columns, ...registrations.map((registration) => columns.map((key) => registration[key]))];
  return `\uFEFF${rows.map((row) => row.map(quoteCell).join(",")).join("\r\n")}\r\n`;
};
