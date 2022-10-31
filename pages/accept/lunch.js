import Head from "next/head";
import Link from "next/link";
import useMedia from "use-media";
import Router from "next/router";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { titleCase } from "../../utils/functions";

import styles from "./accept.module.scss";
import Header from "../../components/Header/Header.js";

import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Home({ tickets }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  let user = null;
  if (typeof window !== "undefined") {
    user = JSON.parse(localStorage.getItem("accepted"));
  }

  useEffect(() => {
    const user = localStorage.getItem("lunch");
    if (!user) {
      Router.push("/lunch");
    }

    fetch("/api/lunch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
      },
      body: JSON.stringify(user),
    })
      .then((response) => {
        if (response.status === 200) {
          //           Router.push("/accept/lunch");
        }
        if (response.status === 404) {
          alert("we didnt find you in our database, please contact us");
          setIsClicked(false);
        }
      })
      .catch((error) => console.log(error));
  }, []);

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
        menuItems={[{ title: "Home", link: "" }]}
      />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.title}>
            <h3>Thank you for your Purchase!</h3>
            <p>
              You will get a confirmation of your sign up by email. Then give us
              a little time to process your registration. Thank you.
            </p>
          </div>
          {user &&
            Object.entries(user).map(([key, val], i) => {
              if (
                (key === "level" || key === "role") &&
                user.ticket === "partyPass"
              ) {
                return;
              }
              return (
                <div className={styles.row} key={i}>
                  <p>{key}:</p> <p>{key === "terms" ? "yes" : val}</p>
                </div>
              );
            })}
          <div
            onClick={() => localStorage.removeItem("accepted")}
            className={styles.button}
          >
            <Link href="/">Wanna do another Registration?</Link>
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
