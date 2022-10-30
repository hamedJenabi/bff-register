import Head from "next/head";
import useMedia from "use-media";
import Router from "next/router";
import React, { useEffect } from "react";
import { unstable_useFormState as useFormState } from "reakit/Form";
import styles from "./dancer.module.scss";
import Header from "../../../../components/Header/Header.js";
import Modal from "./Modal.js";
export default function User({ user }) {
  console.log("user", user);
  const isMobile = useMedia({ maxWidth: "768px" });
  const form = useFormState({
    values: {
      id: user.id,
      status: user.status,
      prevStatus: user.status,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      country: user.country,
      level: user.level,
      ticket: user.ticket,
      role: user.role,
      theme_class: user.theme_class || "",
      competition: user.competition,
      competition_role: user.competition_role,
      competitions: user.competitions?.toString(),
      theme_class: user.theme_class || "",
      price: user.price,
      terms: user.terms,
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
        menuItems={[{ title: "Home", link: "https://bluesfever.eu" }]}
      />
      <main className={styles.main}>
        <div className={styles.contentWrapper}>
          <div className={styles.row}>
            <p>Status:</p>
            <p>{user.status}</p>
          </div>
          <div className={styles.row}>
            <p>First Name:</p>
            <p>{user.first_name}</p>
            <Modal
              disabled
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
              disabled
              user={user}
              handleUser={handleClick}
              info="first_name"
              form={form}
            />
          </div>
          <div className={styles.row}>
            <p>Email:</p>
            <p> {user.email}</p>
            <Modal
              disabled
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
              disabled
              user={user}
              handleUser={handleClick}
              info="ticket"
              form={form}
            />
          </div>
          {user.role && (
            <div className={styles.row}>
              <p>Role:</p>
              <p> {user.role}</p>
              <Modal
                disabled
                user={user}
                handleUser={handleClick}
                info="role"
                form={form}
              />
            </div>
          )}
          {user.level && (
            <div className={styles.row}>
              <p>Level:</p>
              <p> {user.level}</p>
              <Modal
                disabled
                user={user}
                handleUser={handleClick}
                info="level"
                form={form}
              />
            </div>
          )}
          {user.competition_role && (
            <div className={styles.row}>
              <p>Competition Role:</p>
              <p> {user.competition_role}</p>
              <Modal
                disabled
                user={user}
                handleUser={handleClick}
                info="competition_role"
                form={form}
              />
            </div>
          )}
          {user.competitions && (
            <div className={styles.row}>
              <p>Competitions:</p>
              <div>
                {user.competitions.split(",").map((comp) => (
                  <p> {comp}</p>
                ))}
              </div>

              <Modal
                user={user}
                handleUser={handleClick}
                info="competition"
                form={form}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { id } = params;
  const { getUserByEmail } = await import("../../../../db/db");
  const user = await getUserByEmail("hamed.jenabi@gmail.com");
  return {
    props: {
      user: user,
    },
  };
}
