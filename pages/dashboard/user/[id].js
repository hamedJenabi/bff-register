import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import useMedia from "use-media";
import Router from "next/router";
import React, { useEffect } from "react";
import { unstable_useFormState as useFormState } from "reakit/Form";
import styles from "./user.module.scss";
import Header from "../../../components/Header/Header.js";
const Modal = dynamic(() => import("./Modal"), { ssr: false });

export default function User({ user }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  const form = useFormState({
    values: {
      id: user.id,
      status: user.status,
      prevStatus: user.status,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      country: user.country,
      level: user.level,
      ticket: user.ticket,
      role: user.role,
      themeClass: user.themeClass,
      competition: user.competition,
      competition_role: user.competition_role,
      competitions: user.competitions,
      price: user.price,
    },
    onValidate: (values) => {
      // noob
    },
    onSubmit: () => {
      fetch("/api/edituser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store",
        },
        body: JSON.stringify(form.values),
      })
        .then((response) => {
          if (response.status === 200) {
            alert("DONE");
            Router.push("/dashboard/fdjhfdskjfhdskjh");
          }
          if (response.status === 401) {
            alert("Please write a valid status");
          }
        })
        .catch((error) => console.log(error));
    },
  });
  if (typeof window !== "undefined") {
    const admin = localStorage.getItem("login_admin");
    if (admin !== "true") {
      Router.push("/login/admin");
    }
  }
  const handleClick = (key) => {
    alert(key);
  };
  return (
    <div className={styles.container}>
      <Head>
        <title>BLUES FEVER 2022</title>
        <meta name="description" content="BLUES FEVER 2022 Registration" />
        <link rel="icon" href="/icon.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amatic+SC&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Header
        title="BLUES FEVER 2022"
        menuItems={[{ title: "Home", link: "https://thebluesjoint.dance" }]}
      />
      <main className={styles.main}>
        <div className={styles.linkButton}>
          <Link
            className={styles.linkButton}
            href="/dashboard/fdjhfdskjfhdskjh"
          >
            Back to Dashboard
          </Link>
        </div>
        <p style={{ margin: "10px" }}>
          Accepted status: 1.registered 2. email-sent 3. confirmed 4.
          waitinglist 5. canceled
        </p>
        <div className={styles.contentWrapper}>
          <div className={styles.row}>
            <p>Status:</p>
            <p>{user.status}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="status"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>First Name:</p>
            <p>{user.first_name}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="first_name"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Last Name:</p>
            <p>{user.last_name}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="last_name"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Email:</p>
            <p> {user.email}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="email"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Ticket:</p>
            <p> {user.ticket}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="ticket"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Role:</p>
            <p> {user.role}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="role"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Level:</p>
            <p> {user.level}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="level"
              form={form}
            />
          </div>

          <div className={styles.row}>
            <p>Country:</p>
            <p> {user.country}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="country"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Competition:</p>
            <p> {user.competition}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="competition"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Competition Role:</p>
            <p> {user.competition_role}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="competition_role"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Competitions:</p>
            <p> {user.competitions}</p>
            <Modal
              user={user}
              handleUser={handleClick}
              info="competitions"
              form={form}
            />
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

export async function getServerSideProps({ params }) {
  const { id } = params;
  const { getUserById } = await import("../../../db/db");
  const user = await getUserById(id);
  return {
    props: {
      user: user,
    },
  };
}
