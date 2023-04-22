import Head from "next/head";
import useMedia from "use-media";
import Router from "next/router";
import { CSVLink, CSVDownload } from "react-csv";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./Dashboard.module.scss";
import Header from "../../components/Header/Header.js";
import { unstable_useFormState as useFormState } from "reakit/Form";
import classNames from "classnames";
import { levelsToShow, titleCase } from "../../utils/functions";
export default function Dashboard({ users, tickets }) {
  const [nameSearch, setNameSearch] = useState("");
  const [activeSideBar, setActiveSideBar] = useState("all");
  const [capacityShow, setCapacityShow] = useState(false);
  const [userToShow, setUserToShow] = useState(users || []);
  const isMobile = useMedia({ maxWidth: "768px" });

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
    } else if (levelsToShow.some((level) => level.label === item)) {
      setUserToShow(users.filter((user) => titleCase(user.level) === item));
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
      "actions",
      "id",
      "email",
      "firstname",
      "lastname",
      "ticket",
      "role",
      "level",
      "shirt",
      "shirt_size",
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
          role,
          firstname,
          lastname,
          country,
          level,
          shirt,
          shirt_size,
          ticket,
          email,
        }) => {
          return (
            <tr
              className={classNames(styles.normal, {
                [styles.confirmed]: status === "confirmed",
              })}
              key={id}
            >
              <td>{status}</td>
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
              <td>{shirt}</td>
              <td>{shirt_size}</td>
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
        title="VSB DASHBOARD"
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
              key={level.label}
              onClick={() => handleSideBarClick(level.label)}
              className={classNames(styles.sideBarItem, {
                [styles.active]: activeSideBar === level.label,
              })}
            >
              <p>{level.label}</p>
            </div>
          ))}
          {/* <div
            onClick={() => handleSideBarClick("levelTwo")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "levelTwo",
            })}
          >
            <p>Level2</p>
          </div>
          <div
            onClick={() => handleSideBarClick("levelThree")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "levelThree",
            })}
          >
            <p>Level3</p>
          </div> */}
          <div
            onClick={() => handleSideBarClick("partyPass")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "partyPass",
            })}
          >
            <p>Partypass</p>
          </div>
          <div
            onClick={() => handleSideBarClick("shirt")}
            className={classNames(styles.sideBarItem, {
              [styles.active]: activeSideBar === "shirt",
            })}
          >
            <p>Tshirt</p>
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
        </div>
        <div className={styles.content}>
          <div className={styles.search}>
            <p>Search first name</p>
            <input onChange={(e) => setNameSearch(e.target.value)} />
          </div>
          {!capacityShow && (
            <table className={styles.table}>
              <tbody>
                <tr>{renderTableHeader()}</tr>
                {renderTableData()}
              </tbody>
            </table>
          )}
          {capacityShow && <TicketsComponent />}
          {/* <button
            onClick={() => handleCsv(userToShow)}
            className={styles.button}
          >
            Export "{activeSideBar}" to CSV
          </button> */}
          <div className={styles.downloadButton}>
            <CSVLink data={userToShow} filename={"registration-file.csv"}>
              Download CSV
            </CSVLink>
          </div>
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
