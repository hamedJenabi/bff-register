import Head from "next/head";
import Link from "next/link";
import useMedia from "use-media";
import Router from "next/router";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { titleCase } from "../../utils/functions";

import styles from "../../styles/StatusPage.module.scss";
import Header from "../../components/Header/Header.js";

import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Home({ tickets }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  let user = null;
  if (typeof window !== "undefined") {
    user = JSON.parse(localStorage.getItem("accepted_user"));
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>BLUES FEVER 2026</title>
        <meta name="description" content="BLUES FEVER 2026 Registration" />
        <link rel="icon" href="/icon.png" />
      </Head>
      <Header
        title="BLUES FEVER 2026"
        menuItems={[{ title: "Home", link: "https://www.bluesfever.eu/" }]}
      />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.title}>
            <h3>Thank you for your lunch purchase!</h3>
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
