import Head from "next/head";
import Link from "next/link";
import useMedia from "use-media";
import Router, { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { titleCase } from "../../utils/functions";

import styles from "./accept.module.scss";
import Header from "../../components/Header/Header.js";

import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Home({ tickets }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  const router = useRouter();
  const { session_id } = router.query;
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session_id) return;
    let user = null;
    if (typeof window !== "undefined") {
      user = JSON.parse(localStorage.getItem("accepted_user"));
    }

    fetch(`/api/register?session_id=${session_id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
      },
      body: JSON.stringify(user),
    })
      .then((response) => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("accepted_user");
        }
        if (response.status === 301) {
          Router.push("/soldout");
        }
        if (response.status === 302) {
          Router.push("/alreadyRegistered");
        }
      })
      .catch((error) => console.log(error));
  }, [session_id]);

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
            <br />
            <p>
              Please note that your registration confirmation e-mail may end up
              in your <b>junk mail or promotions folder</b>.
            </p>
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
