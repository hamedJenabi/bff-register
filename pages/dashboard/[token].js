import Head from "next/head";
import useMedia from "use-media";
import Router from "next/router";
import { CSVLink, CSVDownload } from "react-csv";
import React, { useState } from "react";
import styles from "./Dashboard.module.scss";
import Header from "../../components/Header/Header.js";
import classNames from "classnames";
import { levelsToShow, titleCase } from "../../utils/functions";

export default function Dashboard({ users, tickets }) {
  console.log("users", users);
  console.log("tickets", tickets);

  const [nameSearch, setNameSearch] = useState("");
  const [activeSideBar, setActiveSideBar] = useState("all");
  const [capacityShow, setCapacityShow] = useState(false);
  const [userToShow, setUserToShow] = useState(users || []);
  const isMobile = useMedia({ maxWidth: "768px" });

  const BalanceComponent = () => {
    const getTicketAmount = (level, role) => {
      const ammount = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "email-sent"
      );
      const ammountPaid = users.filter(
        (user) =>
          user["level"] === level &&
          user["role"] === role &&
          user["status"] === "confirmed"
      );

      return { sent: ammount.length, paid: ammountPaid.length };
    };

    return (
      <div className={styles.balanceComponent}>
        <div className={styles.ticketRow}>
          <p>Level</p>
          <p> Follow</p>
          <p>Lead</p>
        </div>
        {levelsToShow.map((lvl) => (
          <div key={lvl.label} className={styles.ticketRow}>
            <p>{lvl.label}</p>
            <p>
              {getTicketAmount(lvl.value, "follow").sent} (
              {getTicketAmount(lvl.value, "follow").paid})
            </p>
            <p>
              {getTicketAmount(lvl.value, "lead").sent} (
              {getTicketAmount(lvl.value, "lead").paid})
            </p>
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
    if (item === "canceled") {
      setUserToShow(users.filter((user) => user["status"] === "canceled"));
    } else if (item === "all") {
      setUserToShow(users);
    } else if (levelsToShow.some((level) => level.value === item)) {
      setUserToShow(users.filter((user) => user.level === item));
    } else if (item === "shirt") {
      setUserToShow(users.filter((user) => user["shirt"] === "yes"));
    } else if (item === "themeClass") {
      setUserToShow(users.filter((user) => user["theme_class"] !== "no"));
    } else if (item === "thursday") {
      setUserToShow(users.filter((user) => user["thursday"] === "yes"));
    } else if (item === "partyPass") {
      setUserToShow(users.filter((user) => user["ticket"] === "partyPass"));
    } else if (item === "confirmed") {
      setUserToShow(users.filter((user) => user["status"] === "confirmed"));
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
  const renderTableHeader = () => {
    const header = [
      "status",
      "date",
      "actions",
      "id",
      "email",
      "first_name",
      "last_name",
      "ticket",
      "role",
      "level",
      "theme_class",
      "competition",
      "competition_role",
      "competitions",
      "country",
      "price",
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
          ? user.first_name.toUpperCase().includes(nameSearch.toUpperCase())
          : true
      )
      .sort((a, b) => a.id - b.id)
      .map(
        ({
          id,
          status,
          date,
          role,
          first_name,
          ticket,
          last_name,
          country,
          theme_class,
          level,
          competition,
          competition_role,
          competitions,
          email,
          price,
        }) => {
          return (
            <tr
              className={classNames(styles.normal, {
                [styles.confirmed]: status === "confirmed",
                [styles.canceled]: status === "canceled",
                [styles.sent]: status === "email-sent",
              })}
              key={id}
            >
              <td>{status}</td>
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
              <td>{first_name}</td>
              <td>{last_name}</td>
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

              <td>{country}</td>
              <td>{price}</td>
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
        title="Trippin DASHBOARD"
        menuItems={[
          {
            title: "LOG OUT ",
            link: "/login/admin",
          },
        ]}
      />
      <h3 className={styles.title}>Registrations</h3>
      <div className={styles.total}>
        <p>Total Registrations: {users?.length}</p>
        <p>Selected List: {userToShow?.length}</p>
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
            onClick={() => handleSideBarClick("thursday")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "thursday",
            })}
          >
            <p>Thursday Party</p>
          </div>
          <div
            onClick={() => handleSideBarClick("themeClass")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "themeClass",
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
        </div>
        <div className={styles.content}>
          {activeSideBar !== "balance" && (
            <div className={styles.search}>
              <p>Search first name</p>
              <input onChange={(e) => setNameSearch(e.target.value)} />
            </div>
          )}
          {!capacityShow && activeSideBar !== "balance" && (
            <table className={styles.table}>
              <tbody>
                <tr>{renderTableHeader()}</tr>
                {renderTableData()}
              </tbody>
            </table>
          )}
          {capacityShow && <TicketsComponent />}
          {activeSideBar === "balance" && <BalanceComponent />}
          {activeSideBar !== "balance" && (
            <div className={styles.downloadButton}>
              <CSVLink data={userToShow} filename={"registration-file.csv"}>
                Download CSV
              </CSVLink>
            </div>
          )}
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
