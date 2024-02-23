import Head from "next/head";
import Link from "next/link";
import useMedia from "use-media";
import Router from "next/router";
import React, { useState } from "react";

import styles from "./waitinglist.module.scss";
import Header from "../../components/Header/Header.js";

export default function Home() {
  const isMobile = useMedia({ maxWidth: "768px" });
  let user = null;
  if (typeof window !== "undefined") {
    user = JSON.parse(localStorage.getItem("accepted"));
  }
  return (
    <div className={styles.container}>
      <Head>
        <title>BLUES FEVER 2024</title>
        <meta name="description" content="BLUES FEVER 2024 Registration" />
        <link rel="icon" href="/icon.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amatic+SC&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Header
        title="BLUES FEVER 2024"
        menuItems={[{ title: "Home", link: "https://thebluesjoint.dance" }]}
      />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.title}>
            <h3>Thank you for your registration!</h3>

            <p>
              Unfortunately, all the spots are fully booked, so we put you on
              our <strong>waiting list</strong>.
            </p>
            <p>We will contact you in the next 20 days.</p>
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
