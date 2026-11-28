import FooterCredit from "../../components/FooterCredit/FooterCredit";
import RegisteredClasses from "../../components/Reg2026/RegisteredClasses";
import RegistrationLink from "../../components/Reg2026/RegistrationLink";
import ArrivalCheckIn from "../../components/ArrivalCheckIn/ArrivalCheckIn";
import { registrationsCsv } from "../../lib/admin/registrations-csv";
import { adminPageRedirect } from "../../lib/admin/session";
import { arrivalRequest } from "../../lib/app/arrival-client";
import { isClassPass } from "../../lib/reg2026/catalog";
import Head from "next/head";
import Link from "next/link";
import Router from "next/router";
import { useRouter } from "next/router";
import React, { useState } from "react";
import styles from "./Dashboard.module.scss";
import classNames from "classnames";
import {
  finalLevelsToShow,
  levelFor2026,
  titleCase,
} from "../../utils/functions";
import { unstable_FormCheckbox as FormCheckbox } from "reakit/Form";
import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Dashboard({ users, tickets, previewMode, scannerPath }) {
  const [checkedInIds, setCheckedInIds] = useState(() => new Set());
  const [nameSearch, setNameSearch] = useState("");
  const [activeSideBar, setActiveSideBar] = useState("all");
  const [capacityShow, setCapacityShow] = useState(false);
  const [userToShow, setUserToShow] = useState(users || []);
  const [sendingScheduleInvitations, setSendingScheduleInvitations] = useState(false);
  const [scheduleInvitationProgress, setScheduleInvitationProgress] = useState(null);
  const [sendingScheduleInvitationId, setSendingScheduleInvitationId] = useState(null);
  const [scheduleInvitationResults, setScheduleInvitationResults] = useState({});
  const [sendingFinalEmails, setSendingFinalEmails] = useState(false);
  const [finalEmailProgress, setFinalEmailProgress] = useState(null);
  const totalAmount = users.reduce((acc, user) => {
    return (
      acc +
      (user.status !== "canceled" && user.status !== "out"
        ? parseInt(user.price, 10)
        : 0)
    );
  }, 0);
  const totalAmountList = userToShow.reduce((acc, user) => {
    return (
      acc +
      (user.status !== "canceled" && user.status !== "out"
        ? parseInt(user.price, 10)
        : 0)
    );
  }, 0);
  const totalDonation = userToShow.reduce((acc, user) => {
    return (
      acc +
      (user.status !== "canceled" && user.status !== "out" && user.donation
        ? parseInt(user.donation, 10)
        : 0)
    );
  }, 0);
  const router = useRouter();

  const form = useFormState({
    values: {
      status: "",
      users: [],
    },

    onSubmit: (values) => {
      setIsClicked(true);
      const req = {
        ...form.values,
      };
    },
  });
  const [status, setStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [groupLevel, setGroupLevel] = useState("int1");
  const [usersToChange, setUsersToChange] = useState([]);

  const handleStatusChange = async () => {
    const selectedIds = new Set(form.values.users.map(Number));
    const selected = users.filter(({ id }) => selectedIds.has(id));
    if (updatingStatus || !status || !selected.length) return;
    setUpdatingStatus(true);
    setStatusError("");

    const outcomes = await Promise.allSettled(
      selected.map(async (participant) => {
        if (status === "confirmed" && participant.status === "confirmed") {
          await arrivalRequest("undo", { registrationId: participant.id });
          return;
        }
        const response = await fetch("/api/edituser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...participant, status }),
        });
        if (!response.ok) throw new Error("Could not update the registration status.");
      }),
    );
    const failure = outcomes.find(({ status }) => status === "rejected");
    if (failure) {
      setStatusError(failure.reason.message || "Could not change the selected registrations.");
      setUpdatingStatus(false);
      return;
    }
    router.reload();
  };
  const handleGroupChange = async () => {
    const idsToChange = form.values.users;
    let array = [];
    idsToChange.map((id) => {
      array.push(users.find((userinfo) => userinfo.id === id));
    });

    array.map((item) => {
      const toEdit = {
        ...item,
        firstname: item.firstname,
        lastname: item.lastname,
        isGroupApi: true,
        level: groupLevel,
      };
      fetch("/api/edituser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store",
        },
        body: JSON.stringify(toEdit),
      })
        .then((response) => {
          if (response.status === 200) {
            router.reload(window.location.pathname);
          }
          if (response.status === 401) {
            alert("Please write a valid status");
          }
        })
        .catch((error) => console.log(error));
    });
    alert("done");
  };

  const handleFinalEmails = async (selectedIds) => {
    setSendingFinalEmails(true);
    setFinalEmailProgress(null);
    try {
      const audience = await fetch("/api/mailall", { cache: "no-store" });
      const { recipients, error } = await audience.json();
      if (!audience.ok) throw new Error(error);
      const selected = selectedIds ? new Set(selectedIds.map(Number)) : null;
      const participants = selected ? recipients.filter(({ id }) => selected.has(id)) : recipients;
      if (!participants.length) {
        setFinalEmailProgress({ message: "There are no confirmed registrations in this audience." });
        return;
      }
      const target = participants.length === 1
        ? `${participants[0].firstname} ${participants[0].lastname} (${participants[0].email})`
        : `${participants.length} ${selected ? "selected " : ""}confirmed registrations`;
      if (!confirm(`${previewMode ? "Simulate sending" : "Send"} the final email to ${target}? Previously accepted emails will be skipped.`)) return;

      const counts = { sent: 0, already_sent: 0, skipped: 0, failed: 0, uncertain: 0, sending: 0 };
      const issues = [];
      let next = 0;
      let stopped = "";
      const report = () => setFinalEmailProgress({ ...counts, issues: [...issues], total: participants.length, stopped });
      report();
      const worker = async () => {
        while (next < participants.length && !stopped) {
          const participant = participants[next++];
          const label = `${participant.firstname} ${participant.lastname} (#${participant.id})`;
          try {
            const response = await fetch("/api/mailall", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: participant.id }),
            });
            const result = await response.json();
            if ([401, 403, 503].includes(response.status)) {
              stopped = result.error || "Sending stopped. Check the configuration and organizer session.";
              issues.push(`${label}. ${stopped}`);
            } else if (!response.ok) {
              const status = { 409: "skipped", 422: "failed", 502: "failed" }[response.status] || "uncertain";
              counts[status]++;
              issues.push(`${label}. ${result.error || "Delivery status is unavailable."}`);
            } else if (Object.hasOwn(counts, result.status)) {
              counts[result.status]++;
              if (result.status === "uncertain") issues.push(`${label}. Review SendGrid activity before retrying.`);
            } else {
              counts.uncertain++;
              issues.push(`${label}. Delivery status is unavailable.`);
            }
          } catch {
            counts.uncertain++;
            issues.push(`${label}. Connection lost while checking delivery. Resume to see the recorded status.`);
          }
          report();
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, participants.length) }, worker));
    } catch (error) {
      setFinalEmailProgress({ message: error.message || "The final email audience could not be loaded.", stopped: true });
    } finally {
      setSendingFinalEmails(false);
    }
  };
  const handleSendScheduleInvitations = async () => {
    const classPassHolders = users.filter((user) => user.status === "confirmed" && isClassPass(user.ticket));
    if (!classPassHolders.length) {
      setScheduleInvitationProgress({ message: "There are no confirmed Full or Parent Pass holders to invite." });
      return;
    }
    if (!confirm(`Send the schedule invitation to confirmed Full and Parent Pass holders with incomplete schedules (up to ${classPassHolders.length})? This includes people who already received the invitation.`)) return;

    setSendingScheduleInvitations(true);
    const counts = { sent: 0, completed: 0, failed: 0, skipped: 0, uncertain: 0 };
    const issues = [];
    let next = 0;
    let stopped = "";
    const report = () => setScheduleInvitationProgress({ ...counts, issues: [...issues], total: classPassHolders.length, stopped });
    report();
    const worker = async () => {
      while (next < classPassHolders.length && !stopped) {
        const participant = classPassHolders[next++];
        try {
          const response = await fetch("/api/reg2026/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: participant.id, resend: true }),
          });
          const result = await response.json();
          if ([401, 403, 503].includes(response.status)) {
            stopped = result.error || "The invitation batch stopped. Please check configuration and sign in again.";
          } else if (!response.ok) {
            if (response.status === 409) counts.skipped++;
            else counts.failed++;
            issues.push(`${participant.firstname} ${participant.lastname} (#${participant.id}): ${result.error || "Request failed"}`);
          } else if (result.status === "sent") counts.sent++;
          else if (result.status === "completed") counts.completed++;
          else if (result.status === "uncertain" || result.status === "sending") {
            counts.uncertain++;
            issues.push(`${participant.firstname} ${participant.lastname} (#${participant.id}): delivery needs review before another attempt.`);
          } else {
            counts.failed++;
            issues.push(`${participant.firstname} ${participant.lastname} (#${participant.id}): unexpected response.`);
          }
        } catch {
          counts.failed++;
          issues.push(`${participant.firstname} ${participant.lastname} (#${participant.id}): network request failed.`);
        }
        report();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, classPassHolders.length) }, worker));
    setSendingScheduleInvitations(false);
    report();
  };
  const handleSendOneScheduleInvitation = async (participant) => {
    const name = `${participant.firstname} ${participant.lastname}`.trim();
    if (!confirm(`Send the schedule invitation to ${name} (#${participant.id}) at ${participant.email}?`)) return;

    setSendingScheduleInvitationId(participant.id);
    setScheduleInvitationResults((previous) => ({
      ...previous,
      [participant.id]: { message: "Sending schedule invitation…" },
    }));
    try {
      const response = await fetch("/api/reg2026/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: participant.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The invitation could not be sent.");
      const messages = {
        sent: previewMode ? "Captured in preview." : "Accepted by SendGrid.",
        already_sent: "Already sent. No new email was sent.",
        completed: "Registration already complete. No email was sent.",
        uncertain: "Delivery needs review before another attempt.",
        sending: "An invitation is already being sent.",
      };
      setScheduleInvitationResults((previous) => ({
        ...previous,
        [participant.id]: {
          message: messages[result.status] || "Unexpected invitation response.",
          error: !messages[result.status] || result.status === "uncertain",
          done: ["sent", "already_sent", "completed"].includes(result.status),
        },
      }));
    } catch (error) {
      setScheduleInvitationResults((previous) => ({
        ...previous,
        [participant.id]: { message: error.message || "The invitation could not be sent.", error: true },
      }));
    } finally {
      setSendingScheduleInvitationId(null);
    }
  };
  const BalanceComponent = () => {
    const getTicketAmount = (level, role) => {
      const registerAmount = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "registered",
      );
      const ammount = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "email-sent",
      );
      const ammountReminder = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "reminder",
      );
      const ammountWaiting = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "waitinglist",
      );
      const ammountPaid = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "confirmed",
      );
      return {
        registered: registerAmount.length,
        sent: ammount.length,
        reminder: ammountReminder.length,
        waiting: ammountWaiting.length,
        paid: ammountPaid.length,
      };
    };

    return (
      <div className={styles.balanceComponent}>
        <div className={styles.ticketRow}>
          <p>Level</p>
          <p> Follow</p>
          <p>Lead</p>
          <p>Both</p>
        </div>
        {finalLevelsToShow.map((lvl) => (
          <div key={lvl.value} className={styles.ticketRow}>
            <h4>{lvl.value}</h4>
            <p>
              register: {getTicketAmount(lvl.value, "follow").registered} <br />
              send: {getTicketAmount(lvl.value, "follow").sent}
              <br />
              reminder: {getTicketAmount(lvl.value, "follow").reminder}
              <br />
              waitinglist: {getTicketAmount(lvl.value, "follow").waiting}
              <br />
              confirmed: {getTicketAmount(lvl.value, "follow").paid}
            </p>
            <p>
              register: {getTicketAmount(lvl.value, "lead").registered} <br />
              send: {getTicketAmount(lvl.value, "lead").sent} <br />
              reminder: {getTicketAmount(lvl.value, "lead").reminder} <br />
              waitinglist: {getTicketAmount(lvl.value, "lead").waiting} <br />
              confirmed: {getTicketAmount(lvl.value, "lead").paid}
            </p>
            <p>
              register: {getTicketAmount(lvl.value, "both").registered} <br />
              send: {getTicketAmount(lvl.value, "both").sent} <br />
              reminder: {getTicketAmount(lvl.value, "both").reminder} <br />
              waitinglist: {getTicketAmount(lvl.value, "both").waiting} <br />
              confirmed: {getTicketAmount(lvl.value, "both").paid}
            </p>
          </div>
        ))}
      </div>
    );
  };
  const FinalBalanceComponent = () => {
    const getTicketAmount = (level, role) => {
      const registerAmount = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "registered",
      );
      const ammount = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "email-sent",
      );
      const ammountReminder = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "reminder",
      );
      const ammountWaiting = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "waitinglist",
      );
      const ammountPaid = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "confirmed",
      );
      return {
        registered: registerAmount.length,
        sent: ammount.length,
        reminder: ammountReminder.length,
        waiting: ammountWaiting.length,
        paid: ammountPaid.length,
      };
    };

    return (
      <div className={styles.balanceComponent}>
        <div className={styles.ticketRow}>
          <p>Level</p>
          <p> Follow</p>
          <p>Lead</p>
          <p>Both</p>
        </div>
        {finalLevelsToShow.map((lvl) => (
          <div key={lvl.value} className={styles.ticketRow}>
            <h4>{lvl.value}</h4>
            <p>{getTicketAmount(lvl.value, "follow").paid}</p>
            <p> {getTicketAmount(lvl.value, "lead").paid}</p>
            <p> {getTicketAmount(lvl.value, "both").paid}</p>
          </div>
        ))}
      </div>
    );
  };


  const handleSideBarClick = (item) => {
    if (item !== "capacity") {
      setCapacityShow(false);
    }
    if (item === "out") {
      setUserToShow(users.filter((user) => user["status"] === "out"));
    } else if (item === "canceled") {
      setUserToShow(users.filter((user) => user["status"] === "canceled"));
    } else if (item === "all") {
      setUserToShow(users);
    } else if (tickets.some((level) => level.name === item)) {
      setUserToShow(users.filter((user) => user.level === item));
    } else if (item === "shirt") {
      setUserToShow(users.filter((user) => user["shirt"] === "yes"));
    } else if (item === "theme_class") {
      setUserToShow(
        users.filter(
          (user) => user["theme_class"] !== "no" && user["theme_class"] !== "",
        ),
      );
    } else if (item === "email-sent") {
      setUserToShow(users.filter((user) => user["status"] === "email-sent"));
    } else if (item === "reminder") {
      setUserToShow(users.filter((user) => user["status"] === "reminder"));
    } else if (item === "lunch") {
      setUserToShow(users.filter((user) => user["lunch"]));
    } else if (item === "partyPass") {
      setUserToShow(users.filter((user) => user["ticket"] === "partyPass"));
    } else if (item === "confirmed") {
      setUserToShow(users.filter((user) => user["status"] === "confirmed"));
    } else if (item === "waitinglist") {
      setUserToShow(users.filter((user) => user["status"] === "waitinglist"));
    } else if (item === "registered") {
      setUserToShow(users.filter((user) => user["status"] === "registered"));
    } else {
      setUserToShow(users.filter((user) => user[item] === item));
    }
    if (item === "capacity") {
      setCapacityShow(true);
    }
    setActiveSideBar(item);
  };

  const handleUser = (id) => {
    Router.push(`/dashboard/user/${id}`);
  };

  const searchQuery = nameSearch.trim().toLowerCase();
  const visibleUsers = userToShow
    .filter((user) => !searchQuery || [
      user.firstname, user.lastname, user.email, user.ticket, user.level, user.status, user.country,
    ].some((value) => String(value || "").toLowerCase().includes(searchQuery)))
    .sort((a, b) => a.id - b.id);
  const showRegistrations = !capacityShow && activeSideBar !== "balance" && activeSideBar !== "lastbalance";

  const downloadCsv = () => {
    const blob = new Blob([registrationsCsv(visibleUsers)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registration-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const renderTableHeader = () => {
    const header = [
      "Select", "Status", "First name", "Last name", "Actions", "Ticket", "Email",
      "To pay", "Price", "Date", "ID", "Parent partner", "Level", "Role",
      "Classes", "Competition", "Competitions", "Open MnM role", "Newcom. role",
      "Strictly role", "Donation", "T-shirt", "Lunch", "Country", "Terms",
      "Registration link", "App link",
    ];
    return header.map((column) => <th key={column} scope="col">{column}</th>);
  };

  //--------- Ticket Component
  const TicketsComponent = () => {
    const getTicketConfirmedAmount = (ticketName) =>
      users.filter(
        (user) => user.level === ticketName && user.status === "confirmed",
      ).length;

    const getInitialCapacity = (ticketName) => {
      const initalCapacity = [
        {
          name: "fullpass_lead",
          capacity: 160,
        },
        {
          name: "fullpass_follow",
          capacity: 160,
        },
        {
          name: "fullpass_both",
          capacity: 50,
        },
      ];
      return initalCapacity.find((ticket) => ticket.name === ticketName.name)
        ?.capacity;
    };
    const getLevelAmount = (level) =>
      users.filter((user) => user.role === level && user.status === "confirmed")
        .length;

    return (
      <div className={styles.capacityTables}>
        <div className={styles.tickets}>
          <div
            className={classNames(
              styles.ticketRow,
              styles.capacityAvailabilityRow,
            )}
          >
            <p>Level</p>
            <p> Capacity</p>
            <p>Remaining</p>
          </div>

          {[...tickets]
            .sort((a, b) => a.id - b.id)
            .map((ticket) => (
              <div
                key={ticket.name}
                className={classNames(
                  styles.infoRow,
                  styles.capacityAvailabilityRow,
                )}
              >
                <div className={styles.ticketItem}>
                  <p>{ticket.label}</p>
                </div>
                <div className={styles.ticketItem}>
                  <p>{getInitialCapacity(ticket)}</p>
                </div>
                <div className={styles.ticketItem}>
                  <p>{ticket.capacity}</p>
                </div>
              </div>
            ))}
        </div>

        <div className={styles.capacityDivider}>Sold by level</div>

        <div className={styles.tickets}>
          <div className={styles.ticketRow}>
            <p>Level</p>
            <p>Sold</p>
          </div>

          {levelFor2026.map((level) => (
            <div key={level.value} className={styles.infoRow}>
              <div className={styles.ticketItem}>
                <p>
                  {level.label} ({level.value})
                </p>
              </div>
              <div className={styles.ticketItem}>
                <p>{getLevelAmount(level.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  //--------- Table Data

  const renderTableData = () => {
    return visibleUsers
      .map(
        ({
          id,
          status,
          to_pay,
          price,
          date,
          role,
          firstname,
          ticket,
          parent_partner,
          lastname,
          country,
          level,
          competition,
          open_mixnmatch_role,
          newcomers_mixnmatch_role,
          strictly_role,
          competitions,
          theme_class,
          tshirt,
          lunch,
          donation,
          email,
        }) => {
          const checkedIn = status === "confirmed" && checkedInIds.has(id);
          return (
            <tr
              key={id}
              className={classNames({
                [styles.checkedIn]: checkedIn,
                [styles.confirmed]: status === "confirmed",
                [styles.canceled]: status === "canceled",
                [styles.out]: status === "out",
                [styles.sent]: status === "email-sent",
                [styles.reminder]: status === "reminder",
              })}
            >
              <td>
                <label>
                  <FormCheckbox
                    {...form}
                    name="users"
                    value={id}
                    aria-label={`Select ${firstname} ${lastname} (ID ${id})`}
                  />
                </label>
              </td>
              <td><span className={styles.statusBadge}>{checkedIn ? "Checked in" : status}</span></td>
              <td>{firstname}</td>
              <td>{lastname}</td>
              <td>
                <div className={styles.rowActions}>
                  <button className={styles.button} onClick={() => handleUser(id)}>Edit</button>
                  {status === "confirmed" && (
                    <button
                      className={styles.button}
                      onClick={() => handleSendOneScheduleInvitation({ id, firstname, lastname, email })}
                      disabled={sendingScheduleInvitations || sendingScheduleInvitationId !== null || scheduleInvitationResults[id]?.done}
                      aria-label={`Send schedule invitation to ${firstname} ${lastname} (ID ${id})`}
                    >
                      {sendingScheduleInvitationId === id ? "Sending…" : "Send schedule invitation"}
                    </button>
                  )}
                </div>
                {status === "confirmed" && scheduleInvitationResults[id] && (
                  <p className={styles.rowActionMessage} role={scheduleInvitationResults[id].error ? "alert" : "status"}>
                    {scheduleInvitationResults[id].message}
                  </p>
                )}
              </td>
              <td>{ticket}</td>
              <td>{email}</td>
              <td>{to_pay}</td>
              <td>{price}</td>
              <td>{date}</td>
              <td>{id}</td>
              <td>{parent_partner}</td>
              <td>{role}</td>
              <td>{level}</td>
              <td>
                {ticket !== "partyPass" && (
                  <RegisteredClasses id={id} firstname={firstname} lastname={lastname} themeClass={theme_class} buttonClassName={styles.button} />
                )}
              </td>
              <td>{competition}</td>
              <td>
                {competitions && (
                  <div className={styles.tags}>
                    {competitions.split(",").map((comp) => (
                      <span key={comp}>{titleCase(comp)}</span>
                    ))}
                  </div>
                )}
              </td>
              <td>{open_mixnmatch_role}</td>
              <td>{newcomers_mixnmatch_role}</td>
              <td>{strictly_role}</td>
              <td>{donation}</td>
              <td>{tshirt}</td>
              <td>
                {lunch && (
                  <div className={styles.tags}>
                    {lunch.split(",").map((lunch) => (
                      <span key={lunch}>{titleCase(lunch)}</span>
                    ))}
                  </div>
                )}
              </td>

              <td>{country}</td>
              <td>Yes</td>
              <td>
                <RegistrationLink id={id} firstname={firstname} lastname={lastname} buttonClassName={styles.button} />
              </td>
              <td>
                <RegistrationLink id={id} firstname={firstname} lastname={lastname} buttonClassName={styles.button} kind="app" />
              </td>
            </tr>
          );
        },
      );
  };
  return (
    <div className={styles.container}>
      <Head>
        <title>Registrations · Blues Fever dashboard</title>
      </Head>
      <nav className={styles.navigation} aria-label="Dashboard pages">
        <span aria-current="page">Registrations</span>
        <Link href="/dashboard/schedule">Schedule</Link>
        <Link
          className={styles.logout}
          href="/login/admin"
          onClick={() => window.localStorage.removeItem("login_admin")}
        >
          Log out
        </Link>
      </nav>
      <main>
        <h1 className={styles.title}>Registrations</h1>
        <div className={styles.dashboardHeader}>
          <dl className={styles.totals}>
            <div>
              <dt>Total registrations</dt>
              <dd>{users?.length}</dd>
              <dd className={styles.metricDetail}>Total value {Number.isFinite(totalAmount) ? `€${totalAmount}` : "—"}</dd>
            </div>
            <div>
              <dt>Selected list</dt>
              <dd>{userToShow?.filter((user) => user.status !== "canceled" && user.status !== "out")?.length}</dd>
              <dd className={styles.metricDetail}>Total value {Number.isFinite(totalAmountList) ? `€${totalAmountList}` : "—"}</dd>
            </div>
            <div>
              <dt>Donation</dt>
              <dd>€{totalDonation}</dd>
            </div>
          </dl>
          <div className={styles.checkIn}>
            <ArrivalCheckIn scannerPath={scannerPath} setCheckedInIds={setCheckedInIds} />
          </div>
        </div>
        <div className={styles.filters} role="group" aria-label="Registration views">
          {[
            { value: "all", label: "All" },
            { value: "confirmed", label: "Confirmed" },
            ...[...tickets].sort((a, b) => a.id - b.id).map(({ name, label }) => ({ value: name, label: label || name })),
            { value: "partyPass", label: "Party Pass" },
            { value: "lunch", label: "Lunch" },
            { value: "canceled", label: "Canceled" },
            { value: "capacity", label: "Capacity" },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSideBarClick(value)}
              aria-pressed={activeSideBar === value}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.content}>
          {activeSideBar !== "balance" && (
            <div className={styles.search}>
              <label className={styles.searchField}>
                <span>Search registrations</span>
                <input
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder="Name, email, ticket, level, status..."
                />
              </label>

              <div className={styles.bulkActions}>
                <label className={styles.controlField}>
                  <span>Bulk status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={styles.select}
                  >
                    <option value="" disabled>Select a status</option>
                    <option>registered</option>
                    <option>email-sent</option>
                    <option>reminder</option>
                    <option>waitinglist</option>
                    <option>confirmed</option>
                    <option>canceled</option>
                    <option>out</option>
                  </select>
                </label>
                <button
                  className={styles.statusButton}
                  onClick={handleStatusChange}
                  disabled={updatingStatus || !status || !form.values.users.length}
                >
                  {updatingStatus ? "Changing status…" : "Change Status"}
                </button>
              </div>
              {statusError && <p className={styles.statusError} role="alert">{statusError}</p>}

              {/* <select
                onChange={(e) => setStatus(e.target.value)}
                className={styles.select}
              >
                <option>registered</option>
                <option>email-sent</option>
                <option>reminder</option>
                <option>waitinglist</option>
                <option>confirmed</option>
                <option>canceled</option>
                <option>out</option>
              </select> */}

              {/* <select
                onChange={(e) => setGroupLevel(e.target.value)}
                className={styles.select}
              >
                <option>int1</option>
                <option>int2</option>
              </select>
              <button
                className={styles.statusButton}
                onClick={handleGroupChange}
              >
                Change Group Name
              </button> */}

              {/* <p>Search first name</p>
              <input onChange={(e) => setNameSearch(e.target.value)} /> */}
            </div>
          )}

          <button className={styles.statusButton} disabled={sendingFinalEmails || !form.values.users.length} onClick={() => handleFinalEmails(form.values.users)}>
            Send final email to selected confirmed participants
          </button>
          {showRegistrations && (
            <div className={styles.tableScroll} role="region" aria-label="Registrations table" tabIndex={0}>
              <table className={styles.table}>
                <thead><tr>{renderTableHeader()}</tr></thead>
                <tbody>{renderTableData()}</tbody>
              </table>
            </div>
          )}
          {capacityShow && <TicketsComponent />}
          {activeSideBar === "balance" && <BalanceComponent />}
          {activeSideBar === "lastbalance" && <FinalBalanceComponent />}
          {showRegistrations && (
            <div className={styles.downloadButton}>
              <button type="button" className={styles.statusButton} onClick={downloadCsv}>
                Download CSV
              </button>
            </div>
          )}
          <div className={styles.bulkEmailActions}>
            <button className={styles.statusButton} disabled={sendingFinalEmails} onClick={() => handleFinalEmails()}>
              {sendingFinalEmails ? "Preparing or sending final emails…" : "Send Email to All confirmed"}
            </button>
            <button className={styles.statusButton} onClick={handleSendScheduleInvitations} disabled={sendingScheduleInvitations || sendingScheduleInvitationId !== null}>
              {sendingScheduleInvitations ? "Sending schedule invitations…" : "Send schedule invitations to confirmed Full and Parent Pass holders"}
            </button>
          </div>
          {finalEmailProgress && (
            <p className={styles.invitationProgress} role={finalEmailProgress.stopped ? "alert" : "status"}>
              {finalEmailProgress.message ||
                `Final emails for ${finalEmailProgress.total} confirmed registrations. ` +
                `${finalEmailProgress.sent} ${previewMode ? "simulated" : "accepted by SendGrid"}, ${finalEmailProgress.already_sent} already sent, ` +
                `${finalEmailProgress.skipped} skipped, ${finalEmailProgress.failed} failed, ` +
                `${finalEmailProgress.sending} being sent in another request, ${finalEmailProgress.uncertain} require review.`}
            </p>
          )}
          {finalEmailProgress?.issues?.length > 0 && (
            <ul className={styles.invitationIssues}>
              {finalEmailProgress.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          )}
          {scheduleInvitationProgress && (
            <p className={styles.invitationProgress} role={scheduleInvitationProgress.stopped ? "alert" : "status"}>
              {scheduleInvitationProgress.message ||
                `Schedule invitations: ${scheduleInvitationProgress.sent} ${previewMode ? "captured in preview" : "accepted by SendGrid"}, ` +
                `${scheduleInvitationProgress.completed} already complete, ${scheduleInvitationProgress.skipped} otherwise skipped, ` +
                `${scheduleInvitationProgress.failed} failed, ${scheduleInvitationProgress.uncertain} require review. ` +
                `Total: ${scheduleInvitationProgress.total} confirmed Full and Parent Pass holders.`}
              {scheduleInvitationProgress.stopped && ` ${scheduleInvitationProgress.stopped}`}
            </p>
          )}
          {scheduleInvitationProgress?.issues?.length > 0 && (
            <ul className={styles.invitationIssues}>
              {scheduleInvitationProgress.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}
            </ul>
          )}
          {previewMode && (
            <p className={styles.invitationProgress}>
              Preview only: captured invitations are available at{" "}
              <a href="/api/reg2026/preview-invitations" target="_blank" rel="noreferrer">the preview mailbox</a>.
              Registration confirmations are available at{" "}
              <a href="/api/reg2026/preview-confirmations" target="_blank" rel="noreferrer">the confirmation mailbox</a>.
              No email leaves this preview.
            </p>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <FooterCredit />
      </footer>
    </div>
  );
}

export async function getServerSideProps({ req, res, params }) {
  const redirect = adminPageRedirect(req, res);
  if (redirect) return redirect;
  const { getAllUsers, getTickets } = await import("../../db/db");
  const users = await getAllUsers();

  const tickets = await getTickets();
  return {
    props: {
      users: users,
      tickets: tickets,
      scannerPath: `/dashboard/${encodeURIComponent(params.token)}/scan`,
      previewMode: process.env.BFF_PREVIEW === "true" && process.env.NODE_ENV !== "production",
    },
  };
}
