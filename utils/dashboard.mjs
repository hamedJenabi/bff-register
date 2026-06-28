export const MANUAL_STATUS_OPTIONS = [
  "registered",
  "email-sent",
  "reminder",
  "waitinglist",
  "confirmed",
  "canceled",
  "out",
];

export const ACTIVE_REGISTRATION_STATUSES = [
  "registered",
  "email-sent",
  "reminder",
  "confirmed",
];

export const INACTIVE_REGISTRATION_STATUSES = ["waitinglist", "canceled", "out"];

const searchableFields = [
  "id",
  "email",
  "firstname",
  "lastname",
  "country",
  "ticket",
  "level",
  "role",
  "status",
  "lunch",
  "competitions",
];

export function isActiveRegistration(user = {}) {
  return ACTIVE_REGISTRATION_STATUSES.includes(user.status);
}

export function matchesDashboardSearch(user = {}, search = "") {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return searchableFields.some((field) =>
    String(user[field] ?? "")
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

export function filterDashboardUsers(users = [], filters = {}) {
  const {
    search = "",
    status = "all",
    ticket = "all",
    level = "all",
    extra = "all",
  } = filters;

  return users.filter((user) => {
    if (!matchesDashboardSearch(user, search)) {
      return false;
    }

    if (status !== "all" && user.status !== status) {
      return false;
    }

    if (ticket !== "all" && user.ticket !== ticket) {
      return false;
    }

    if (level !== "all" && user.level !== level) {
      return false;
    }

    if (extra === "lunch" && !user.lunch) {
      return false;
    }

    if (extra === "competition" && user.competition !== "yes") {
      return false;
    }

    if (extra === "donation" && Number(user.donation || 0) <= 0) {
      return false;
    }

    return true;
  });
}

export function calculateDashboardStats(users = []) {
  return users.reduce(
    (stats, user) => {
      const price = Number.parseInt(user.price || 0, 10) || 0;
      const donation = Number.parseInt(user.donation || 0, 10) || 0;

      stats.total += 1;

      if (isActiveRegistration(user)) {
        stats.active += 1;
        stats.revenue += price;
        stats.donation += donation;
      }

      if (user.status === "confirmed") {
        stats.confirmed += 1;
      }

      if (user.status === "waitinglist") {
        stats.waitinglist += 1;
      }

      if (user.status === "canceled" || user.status === "out") {
        stats.canceled += 1;
      }

      return stats;
    },
    {
      total: 0,
      active: 0,
      confirmed: 0,
      waitinglist: 0,
      canceled: 0,
      revenue: 0,
      donation: 0,
    },
  );
}

export function getActiveCountForTicket(users = [], ticketName = "") {
  return users.filter(
    (user) => user.level === ticketName && isActiveRegistration(user),
  ).length;
}

export function getUniqueOptions(users = [], field = "") {
  return Array.from(
    new Set(users.map((user) => user[field]).filter(Boolean)),
  ).sort((a, b) => String(a).localeCompare(String(b)));
}

export function formatCurrency(amount = 0) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}
