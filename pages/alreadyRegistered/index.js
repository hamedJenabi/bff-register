import Head from "next/head";
import Link from "next/link";
import useMedia from "use-media";
import Router from "next/router";
import React, { useState } from "react";
import dynamic from "next/dynamic";

import styles from "./alreadyRegistered.module.scss";
import Header from "../../components/Header/Header.js";

import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Home({ tickets }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  let user = null;
  if (typeof window !== "undefined") {
    user = JSON.parse(localStorage.getItem("accepted"));
  }
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
        <div className={styles.content}>
          <div className={styles.title}>
            <h3>You are already registered for VSB 2022!</h3>
            <p>Check you email for more information.</p>
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
