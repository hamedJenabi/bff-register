import Head from "next/head";
import Link from "next/link";
import useMedia from "use-media";
import Router, { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { titleCase } from "../../utils/functions.js";

import styles from "./cancel.module.scss";
import Header from "../../components/Header/Header.js";

import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Home({ tickets }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  const router = useRouter();
  const { session_id } = router.query;

  const [loading, setLoading] = useState(true);

  return (
    <div className={styles.container}>
      <Head>
        <title>BLUES FEVER 2024</title>
        <meta name="description" content="BLUES FEVER 2023 Registration" />
        <link rel="icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amatic+SC&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Header
        title="BLUES FEVER 2023"
        menuItems={[{ title: "Home", link: "" }]}
      />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.title}>
            <h3>You've cancelled your registration</h3>
            <br />
            <br />
            <p>
              your registration is NOT completed. If you want to register again,
              please click the button below.
            </p>
            <Link href="/" className={styles.button}>
              Register Again
            </Link>
            <br />
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
