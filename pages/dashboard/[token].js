import Head from "next/head";
import useMedia from "use-media";
import Router from "next/router";
import { useRouter } from "next/router";
import { CSVLink, CSVDownload } from "react-csv";
import React, { useState } from "react";
import styles from "./Dashboard.module.scss";
import Header from "../../components/Header/Header.js";
import classNames from "classnames";
import {
  levelsToShow,
  groupLevelsToShow,
  titleCase,
} from "../../utils/functions";
import { unstable_FormCheckbox as FormCheckbox } from "reakit/Form";
import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Dashboard({ users, tickets }) {
  const [nameSearch, setNameSearch] = useState("");
  const [activeSideBar, setActiveSideBar] = useState("all");
  const [capacityShow, setCapacityShow] = useState(false);
  const [userToShow, setUserToShow] = useState(users || []);
  const isMobile = useMedia({ maxWidth: "768px" });
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
  const [groupLevel, setGroupLevel] = useState("trumpet1");
  const [usersToChange, setUsersToChange] = useState([]);
  const handleStatusChange = async () => {
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
        status: status,
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

  const handleSendEmail = async () => {
    const confirmedUsers = users.filter((user) => user.status === "confirmed");

    if (
      confirm("are you sure you want to send emails to all confirmed users?")
    ) {
      console.log("ok");

      confirmedUsers.map((user) => {
        fetch("/api/mailall", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store",
          },
          body: JSON.stringify(user),
        })
          .then((response) => {
            if (response.status === 200) {
              //               router.reload(window.location.pathname);
            }
            if (response.status === 401) {
              alert("Please write a valid status");
            }
          })
          .catch((error) => console.log(error));
      });
    } else {
      console.log("no");
    }
  };
  const handleSendOneMail = async () => {
    const idsToSend = form.values.users;
    let array = [];
    idsToSend.map((id) => {
      array.push(users.find((userinfo) => userinfo.id === id));
    });
    if (confirm("are you sure you want to send emails to this user?")) {
      console.log("ok");
      array.map((item) => {
        fetch("/api/mailall", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store",
          },
          body: JSON.stringify(item),
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
    } else {
      console.log("no");
    }
  };

  const BalanceComponent = () => {
    const getTicketAmount = (level, role) => {
      const registerAmount = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "registered"
      );
      const ammount = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "email-sent"
      );
      const ammountReminder = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "reminder"
      );
      const ammountWaiting = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "waitinglist"
      );
      const ammountPaid = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "confirmed"
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
        </div>
        {levelsToShow.map((lvl) => (
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
          user["status"] === "registered"
      );
      const ammount = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "email-sent"
      );
      const ammountReminder = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "reminder"
      );
      const ammountWaiting = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "waitinglist"
      );
      const ammountPaid = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "confirmed"
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
        </div>
        {groupLevelsToShow.map((lvl) => (
          <div key={lvl.value} className={styles.ticketRow}>
            <h4>{lvl.value}</h4>
            <p>{getTicketAmount(lvl.value, "follow").paid}</p>
            <p> {getTicketAmount(lvl.value, "lead").paid}</p>
          </div>
        ))}
      </div>
    );
  };
  if (typeof window !== "undefined") {
    const admin = localStorage.getItem("login_admin");
    if (admin !== "true") {
      Router.push("/login/admin");
    }
  }

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
    } else if (levelsToShow.some((level) => level.value === item)) {
      setUserToShow(users.filter((user) => user.level === item));
    } else if (item === "shirt") {
      setUserToShow(users.filter((user) => user["shirt"] === "yes"));
    } else if (item === "theme_class") {
      setUserToShow(
        users.filter(
          (user) => user["theme_class"] !== "no" && user["theme_class"] !== ""
        )
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

  const getToPay = (to_pay, lunch) => {
    const lunchMoney = lunch?.split(",").length * 12.5 || 0;
    return Number(to_pay) + lunchMoney;
  };
  const usersForCSV = userToShow.map((user) =>
    user.lunch || user.competition === "later"
      ? { ...user, to_pay: getToPay(user.to_pay, user.lunch) }
      : user
  );

  const renderTableHeader = () => {
    const header = [
      "select",
      "status",
      "price",
      "date",
      "actions",
      "id",
      "email",
      "firstname",
      "lastname",
      "ticket",
      "role",
      "level",
      "themed class",
      "competition",
      "competition role",
      "competitions",
      "donation",
      "lunch",
      "country",
      "terms",
    ];
    return header.map((key, index) => {
      return <th key={index}>{key.toUpperCase()}</th>;
    });
  };

  //--------- Ticket Component
  const TicketsComponent = () => {
    const ticketToshow = [
      { name: "Level", capacity: "Capacity", waiting_list: "Waiting List" },
      ...tickets,
    ];
    return (
      <div className={styles.tickets}>
        {ticketToshow?.map((ticket) => (
          <div key={ticket.name} className={styles.ticketRow}>
            <div className={styles.ticketItem}>
              <p>{ticket.name}</p>
            </div>
            <div className={styles.ticketItem}>
              <p>{ticket.capacity}</p>
            </div>
            <div className={styles.ticketItem}>
              <p>{ticket.waiting_list}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };
  //--------- Table Data

  const renderTableData = () => {
    return userToShow
      .filter((user) =>
        nameSearch
          ? user.firstname.toUpperCase().includes(nameSearch.toUpperCase())
          : true
      )
      .sort((a, b) => a.id - b.id)
      .map(
        ({
          id,
          status,
          price,
          date,
          role,
          firstname,
          ticket,
          lastname,
          country,
          theme_class,
          level,
          competition,
          competition_role,
          competitions,
          lunch,
          donation,
          email,
        }) => {
          // const getToPay = (to_pay, lunch) => {
          //   const lunchMoney = lunch?.split(",").length * 12.5 || 0;
          //   return Number(to_pay) + lunchMoney;
          // };
          return (
            <tr
              key={id}
              className={classNames(styles.normal, {
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
                    style={{ width: "60px" }}
                    {...form}
                    name="users"
                    value={id}
                  />
                </label>
              </td>
              {/* <td>{getToPay(to_pay, lunch)}</td> */}
              <td>{status}</td>
              <td>{price}</td>
              <td>{date}</td>
              <td>
                <button
                  className={styles.button}
                  onClick={() => handleUser(id)}
                >
                  Edit
                </button>
              </td>
              <td>{id}</td>
              <td>{email}</td>
              <td>{firstname}</td>
              <td>{lastname}</td>
              <td>{ticket}</td>
              <td>{role}</td>
              <td>{level}</td>
              <td>{titleCase(theme_class)}</td>
              <td>{competition}</td>
              <td>{competition_role}</td>
              <td>
                {competitions && (
                  <div style={{ display: "flex", gap: "10px" }}>
                    {competitions.split(",").map((comp) => (
                      <p
                        key={comp}
                        style={{
                          border: "1px solid blue",
                          padding: "1px 2px",
                          fontSize: "12px",
                        }}
                      >
                        {titleCase(comp)}
                      </p>
                    ))}
                  </div>
                )}
              </td>
              <td>{donation}</td>
              <td>
                {lunch && (
                  <div style={{ display: "flex", gap: "10px" }}>
                    {lunch.split(",").map((lunch) => (
                      <p
                        key={lunch}
                        style={{
                          border: "1px solid blue",
                          padding: "1px 2px",
                          fontSize: "12px",
                        }}
                      >
                        {titleCase(lunch)}
                      </p>
                    ))}
                  </div>
                )}
              </td>

              <td>{country}</td>
              <td>Yes</td>
            </tr>
          );
        }
      );
  };
  return (
    <div className={styles.container}>
      <Head>
        <title>BLUES FEVER 2022</title>
        <link rel="icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amatic+SC&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Header
        isAdmin
        title="BFF DASHBOARD"
        menuItems={[
          {
            title: "LOG OUT ",
            link: "/login/admin",
          },
        ]}
      />
      <h3 className={styles.title}>Registrations</h3>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <div className={styles.total}>
          <p>
            Total Registrations: {users?.length} = {totalAmount}
          </p>
          <p>
            Selected List:{" "}
            {
              userToShow?.filter(
                (user) => user.status !== "canceled" && user.status !== "out"
              )?.length
            }{" "}
            ={totalAmountList}
          </p>
        </div>
      </div>
      <main className={styles.main}>
        <div className={styles.sideBar}>
          <div
            onClick={() => handleSideBarClick("all")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "all",
            })}
          >
            <p>All</p>
          </div>
          <div
            onClick={() => handleSideBarClick("registered")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "registered",
            })}
          >
            <p>registered</p>
          </div>
          <div
            onClick={() => handleSideBarClick("email-sent")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "email-sent",
            })}
          >
            <p>email-sent</p>
          </div>
          <div
            onClick={() => handleSideBarClick("reminder")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "reminder",
            })}
          >
            <p>Reminder</p>
          </div>
          <div
            onClick={() => handleSideBarClick("waitinglist")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "waitinglist",
            })}
          >
            <p>waitinglist</p>
          </div>
          <div
            onClick={() => handleSideBarClick("confirmed")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "confirmed",
            })}
          >
            <p>confirmed</p>
          </div>
          {levelsToShow.map((level) => (
            <div
              key={level.value}
              onClick={() => handleSideBarClick(level.value)}
              className={classNames(styles.sideBarItem, {
                [styles.active]: activeSideBar === level.value,
              })}
            >
              <p>{titleCase(level.value)}</p>
            </div>
          ))}
          <div
            onClick={() => handleSideBarClick("partyPass")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "partyPass",
            })}
          >
            <p>Partypass</p>
          </div>
          <div
            onClick={() => handleSideBarClick("lunch")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "lunch",
            })}
          >
            <p>Lunch</p>
          </div>

          <div
            onClick={() => handleSideBarClick("theme_class")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "theme_class",
            })}
          >
            <p>Themed Classes</p>
          </div>
          <div
            onClick={() => handleSideBarClick("canceled")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "canceled",
            })}
          >
            <p>Canceled</p>
          </div>
          <div
            onClick={() => handleSideBarClick("capacity")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "capacity",
            })}
          >
            <p>Capacity</p>
          </div>
          <div
            onClick={() => handleSideBarClick("balance")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "balance",
            })}
          >
            <p>Balance</p>
          </div>
          <div
            onClick={() => handleSideBarClick("lastbalance")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "lastbalance",
            })}
          >
            <p>Final Balance</p>
          </div>
        </div>
        <div className={styles.content}>
          {activeSideBar !== "balance" && (
            <div className={styles.search}>
              <select
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
              </select>
              <button
                className={styles.statusButton}
                onClick={handleStatusChange}
              >
                Change Status
              </button>

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
                <option>trumpet1</option>
                <option>trumpet2</option>
                <option>drums1</option>
                <option>drums2</option>
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
          <button className={styles.statusButton} onClick={handleSendOneMail}>
            Send Final email to:
          </button>
          {!capacityShow &&
            activeSideBar !== "balance" &&
            activeSideBar !== "lastbalance" && (
              <table className={styles.table}>
                <tbody>
                  <tr>{renderTableHeader()}</tr>
                  {renderTableData()}
                </tbody>
              </table>
            )}
          {capacityShow && <TicketsComponent />}
          {activeSideBar === "balance" && <BalanceComponent />}
          {activeSideBar === "lastbalance" && <FinalBalanceComponent />}
          {activeSideBar !== "balance" && (
            <div className={styles.downloadButton}>
              <CSVLink data={usersForCSV} filename={"registration-file.csv"}>
                Download CSV
              </CSVLink>
            </div>
          )}
          <button
            style={{ margin: "40px 0" }}
            className={classNames(styles.statusButton, {
              [styles.disable]: true,
            })}
            onClick={handleSendEmail}
            disabled
          >
            Send Email to All confirmed
          </button>
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          style={{ width: "auto" }}
          href="https://hamedjenabi.me"
          target="_blank"
          rel="noreferrer"
        >
          Powered with love by Hamed
        </a>
      </footer>
    </div>
  );
}

export async function getServerSideProps() {
  const { getAllUsers, getTickets } = await import("../../db/db");
  const users = await getAllUsers();

  const tickets = await getTickets();
  return {
    props: {
      users: users,
      tickets: tickets,
    },
  };
}
