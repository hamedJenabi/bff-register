import Head from "next/head";
import Router, { useRouter } from "next/router";
import { CSVLink } from "react-csv";
import React, { useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.scss";
import {
  calculateDashboardStats,
  filterDashboardUsers,
  formatCurrency,
  getActiveCountForTicket,
  getUniqueOptions,
  MANUAL_STATUS_OPTIONS,
} from "../../utils/dashboard.mjs";

const dashboardPath = "/dashboard/fdjhfdskjfhdskjh";

const quickFilters = [
  { label: "All", value: "all" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Waiting list", value: "waitinglist" },
  { label: "Canceled", value: "canceled" },
];

const extraFilters = [
  { label: "All extras", value: "all" },
  { label: "Lunch", value: "lunch" },
  { label: "Competition", value: "competition" },
  { label: "Donation", value: "donation" },
];

function getStatusClass(status) {
  const statusClasses = {
    confirmed: styles.statusConfirmed,
    registered: styles.statusRegistered,
    "email-sent": styles.statusSent,
    reminder: styles.statusReminder,
    waitinglist: styles.statusWaiting,
    canceled: styles.statusCanceled,
    out: styles.statusOut,
  };

  return statusClasses[status] || styles.statusDefault;
}

function getListItems(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function Dashboard({ users, tickets, dbError }) {
  const router = useRouter();
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    ticket: "all",
    level: "all",
    extra: "all",
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("registered");
  const [capacityDrafts, setCapacityDrafts] = useState(() =>
    tickets.reduce(
      (drafts, ticket) => ({
        ...drafts,
        [ticket.id]: ticket.capacity,
      }),
      {},
    ),
  );
  const [savingTicketId, setSavingTicketId] = useState(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setIsMounted(true);
    const admin = window.localStorage.getItem("login_admin");

    if (admin !== "true") {
      Router.push("/login/admin");
    }
  }, []);

  const stats = useMemo(() => calculateDashboardStats(users), [users]);
  const filteredUsers = useMemo(
    () => filterDashboardUsers(users, filters).sort((a, b) => a.id - b.id),
    [filters, users],
  );
  const filteredStats = useMemo(
    () => calculateDashboardStats(filteredUsers),
    [filteredUsers],
  );
  const ticketOptions = useMemo(() => getUniqueOptions(users, "ticket"), [users]);
  const levelOptions = useMemo(
    () =>
      tickets
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((ticket) => ({ value: ticket.name, label: ticket.label })),
    [tickets],
  );
  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(user.id)),
    [selectedIds, users],
  );
  const allVisibleSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((user) => selectedIds.includes(user.id));

  const updateFilter = (name, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
    setSelectedIds([]);
  };

  const handleLogout = () => {
    window.localStorage.removeItem("login_admin");
    Router.push("/login/admin");
  };

  const toggleSelected = (id) => {
    setSelectedIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((selectedId) => selectedId !== id)
        : [...currentIds, id],
    );
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(filteredUsers.map((user) => user.id));
  };

  const reloadDashboard = () => router.replace(router.asPath || dashboardPath);

  const handleBulkStatusChange = async () => {
    if (selectedUsers.length === 0) {
      alert("Select at least one registration first.");
      return;
    }

    const confirmed = window.confirm(
      `Change ${selectedUsers.length} registration(s) to "${bulkStatus}" in the database only?`,
    );

    if (!confirmed) {
      return;
    }

    setIsBulkSaving(true);

    await Promise.all(
      selectedUsers.map((user) =>
        fetch("/api/edituser?action=edit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store",
          },
          body: JSON.stringify({
            ...user,
            prevStatus: user.status,
            status: bulkStatus,
          }),
        }),
      ),
    );

    setIsBulkSaving(false);
    reloadDashboard();
  };

  const handleSendEmail = async (targetUsers, message) => {
    if (targetUsers.length === 0) {
      alert("No registrations match this email action.");
      return;
    }

    if (!window.confirm(message)) {
      return;
    }

    await Promise.all(
      targetUsers.map((user) =>
        fetch("/api/mailall", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store",
          },
          body: JSON.stringify(user),
        }),
      ),
    );

    alert("Email request sent.");
  };

  const handleCapacitySave = async (ticket) => {
    setSavingTicketId(ticket.id);

    const response = await fetch("/api/tickets", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ticketId: ticket.id,
        capacity: Number(capacityDrafts[ticket.id]),
      }),
    });

    setSavingTicketId(null);

    if (response.status !== 200) {
      const body = await response.json().catch(() => ({}));
      alert(body.error || "Could not update capacity.");
      return;
    }

    reloadDashboard();
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>BFF Registration Dashboard</title>
        <link rel="icon" href="/icon.png" />
      </Head>

      <header className={styles.topBar}>
        <div>
          <p className={styles.eyebrow}>Blues Fever registration</p>
          <h1>Dashboard</h1>
        </div>
        <button className={styles.ghostButton} onClick={handleLogout}>
          Log out
        </button>
      </header>

      <main className={styles.dashboard}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Live admin control</p>
            <h2>Manage registrations, capacity, exports, and emails.</h2>
          </div>
          <div className={styles.heroMeta}>
            <span>{filteredUsers.length} shown</span>
            <span>{selectedIds.length} selected</span>
          </div>
        </section>

        {dbError && (
          <section className={styles.errorPanel}>
            <strong>Database connection unavailable</strong>
            <p>
              The dashboard shell loaded, but live registrations and tickets
              could not be fetched. Refresh after the database connection is
              available.
            </p>
          </section>
        )}

        <section className={styles.metricGrid} aria-label="Dashboard summary">
          <div className={styles.metricCard}>
            <span>Total</span>
            <strong>{stats.total}</strong>
            <p>{filteredStats.total} in current view</p>
          </div>
          <div className={styles.metricCard}>
            <span>Active spots used</span>
            <strong>{stats.active}</strong>
            <p>Excludes waiting list, canceled, and out</p>
          </div>
          <div className={styles.metricCard}>
            <span>Confirmed</span>
            <strong>{stats.confirmed}</strong>
            <p>{stats.waitinglist} waiting list</p>
          </div>
          <div className={styles.metricCard}>
            <span>Revenue</span>
            <strong>{formatCurrency(stats.revenue)}</strong>
            <p>{formatCurrency(stats.donation)} donations</p>
          </div>
        </section>

        <section className={styles.workspace}>
          <aside className={styles.sidePanel}>
            <div>
              <p className={styles.panelLabel}>Quick filters</p>
              <div className={styles.pillGroup}>
                {quickFilters.map((filter) => (
                  <button
                    key={filter.value}
                    className={
                      filters.status === filter.value
                        ? styles.activePill
                        : styles.pillButton
                    }
                    onClick={() => updateFilter("status", filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.bulkBox}>
              <p className={styles.panelLabel}>Selected registrations</p>
              <strong>{selectedIds.length}</strong>
              <select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value)}
              >
                {MANUAL_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                className={styles.primaryButton}
                disabled={isBulkSaving}
                onClick={handleBulkStatusChange}
              >
                {isBulkSaving ? "Saving..." : "Change DB status"}
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() =>
                  handleSendEmail(
                    selectedUsers,
                    `Send the final email to ${selectedUsers.length} selected registration(s)?`,
                  )
                }
              >
                Send selected email
              </button>
            </div>
          </aside>

          <section className={styles.mainPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Registrations</p>
                <h3>Find, filter, and act</h3>
              </div>
              {isMounted ? (
                <CSVLink
                  className={styles.secondaryButton}
                  data={filteredUsers}
                  filename={`registration-${today}.csv`}
                >
                  Export CSV
                </CSVLink>
              ) : (
                <button className={styles.secondaryButton} disabled>
                  Export CSV
                </button>
              )}
            </div>

            <div className={styles.filterGrid}>
              <label>
                Search
                <input
                  value={filters.search}
                  onChange={(event) =>
                    updateFilter("search", event.target.value)
                  }
                  placeholder="Name, email, country, ticket..."
                />
              </label>
              <label>
                Ticket
                <select
                  value={filters.ticket}
                  onChange={(event) =>
                    updateFilter("ticket", event.target.value)
                  }
                >
                  <option value="all">All tickets</option>
                  {ticketOptions.map((ticket) => (
                    <option key={ticket} value={ticket}>
                      {ticket}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Track
                <select
                  value={filters.level}
                  onChange={(event) => updateFilter("level", event.target.value)}
                >
                  <option value="all">All tracks</option>
                  {levelOptions.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Extras
                <select
                  value={filters.extra}
                  onChange={(event) => updateFilter("extra", event.target.value)}
                >
                  {extraFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.tableShell}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="Select all visible registrations"
                        checked={allVisibleSelected}
                        type="checkbox"
                        onChange={toggleAllVisible}
                      />
                    </th>
                    <th>Status</th>
                    <th>Attendee</th>
                    <th>Pass</th>
                    <th>Money</th>
                    <th>Extras</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const extras = [
                      ...getListItems(user.competitions),
                      ...getListItems(user.lunch),
                      user.tshirt,
                    ].filter(Boolean);

                    return (
                      <tr key={user.id}>
                        <td>
                          <input
                            aria-label={`Select ${user.firstname} ${user.lastname}`}
                            checked={selectedIds.includes(user.id)}
                            type="checkbox"
                            onChange={() => toggleSelected(user.id)}
                          />
                        </td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${getStatusClass(
                              user.status,
                            )}`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td>
                          <div className={styles.attendeeCell}>
                            <strong>
                              {user.firstname} {user.lastname}
                            </strong>
                            <span>
                              #{user.id} · {user.email}
                            </span>
                            <span>{user.country}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.stackCell}>
                            <strong>{user.ticket || "No ticket"}</strong>
                            <span>{user.level || "No track"}</span>
                            <span>{user.role || "No role"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.stackCell}>
                            <strong>{formatCurrency(Number(user.price || 0))}</strong>
                            <span>To pay: {user.to_pay || "0"}</span>
                            <span>Donation: {user.donation || "0"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.chipList}>
                            {extras.length > 0 ? (
                              extras.slice(0, 4).map((extra) => (
                                <span key={`${user.id}-${extra}`}>
                                  {extra}
                                </span>
                              ))
                            ) : (
                              <span>No extras</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            className={styles.tableButton}
                            onClick={() => Router.push(`/dashboard/user/${user.id}`)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.footerActions}>
              <button
                className={styles.secondaryButton}
                onClick={() =>
                  handleSendEmail(
                    users.filter((user) => user.status === "confirmed"),
                    "Send the final email to all confirmed registrations?",
                  )
                }
              >
                Send all confirmed email
              </button>
            </div>
          </section>
        </section>

        <section className={styles.capacityPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Capacity</p>
              <h3>Edit remaining spots</h3>
            </div>
            <p className={styles.helpText}>
              This updates the current DB value used by registration availability.
            </p>
          </div>

          <div className={styles.capacityGrid}>
            {tickets
              .slice()
              .sort((a, b) => a.id - b.id)
              .map((ticket) => (
                <div key={ticket.id} className={styles.capacityRow}>
                  <div>
                    <strong>{ticket.label}</strong>
                    <span>{ticket.name}</span>
                  </div>
                  <div>
                    <span>Active</span>
                    <strong>{getActiveCountForTicket(users, ticket.name)}</strong>
                  </div>
                  <div>
                    <span>Waiting</span>
                    <strong>{ticket.waiting_list}</strong>
                  </div>
                  <label>
                    Remaining spots
                    <input
                      min="0"
                      type="number"
                      value={capacityDrafts[ticket.id] ?? 0}
                      onChange={(event) =>
                        setCapacityDrafts((drafts) => ({
                          ...drafts,
                          [ticket.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    className={styles.primaryButton}
                    disabled={savingTicketId === ticket.id}
                    onClick={() => handleCapacitySave(ticket)}
                  >
                    {savingTicketId === ticket.id ? "Saving..." : "Save"}
                  </button>
                </div>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export async function getServerSideProps() {
  try {
    const { getAllUsers, getTickets } = await import("../../db/db");
    const { withTimeout } = await import("../../utils/serverData");
    const [users, tickets] = await withTimeout(
      Promise.all([getAllUsers(), getTickets()]),
      3000,
      "Dashboard data request timed out",
    );

    return {
      props: {
        users,
        tickets,
        dbError: false,
      },
    };
  } catch (error) {
    console.error("Could not load dashboard data", error.message);

    return {
      props: {
        users: [],
        tickets: [],
        dbError: true,
      },
    };
  }
}
