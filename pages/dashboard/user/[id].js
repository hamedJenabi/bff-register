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

const header = [
  "status",
  "price",
  "id",
  "email",
  "firstname",
  "lastname",
  "ticket",
  "parent_partner",
  "role",
  "level",
  "competition",
  "open_mixnmatch_role",
  "newcomers_mixnmatch_role",
  "strictly_role",
  "tshirt",
  "competitions",
  "donation",
  "lunch",
];

export default function User({ user }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  const form = useFormState({
    values: {
      id: user.id,
      status: user.status,
      prevStatus: user.status,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      country: user.country,
      level: user.level,
      ticket: user.ticket,
      role: user.role,
      competition: user.competition,
      open_mixnmatch_role: user.open_mixnmatch_role,
      newcomers_mixnmatch_role: user.newcomers_mixnmatch_role,
      strictly_role: user.strictly_role,
      competitions: user.competitions?.toString(),
      price: user.price,
      parent_partner: user.parent_partner,
      donation: user.donation,
      tshirt: user.tshirt,
      lunch: user.lunch,
      terms: user.terms,
    },
    onValidate: (values) => {
      // noob
    },
    onSubmit: () => {
      fetch("/api/edituser?action=edit", {
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
        <Link className={styles.linkButton} href="/dashboard/fdjhfdskjfhdskjh">
          Back to Dashboard
        </Link>

        <p style={{ margin: "10px" }}>
          Accepted status: 1.registered 2. email-sent 3. confirmed 4.
          waitinglist 5. canceled
        </p>
        <div className={styles.contentWrapper}>
          {header.map((item) => (
            <div className={styles.row}>
              <p>{item}:</p>
              <p>{user[item]}</p>
              <Modal user={user} info={item} form={form} />
            </div>
          ))}
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
