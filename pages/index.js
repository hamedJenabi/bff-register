import Head from "next/head";
import useMedia from "use-media";
import Router from "next/router";
import { useRouter } from "next/router";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import { emailRegex } from "../utils/validate";
import styles from "../styles/Home.module.scss";
import Header from "../components/Header/Header.js";
const RegistrationForm = dynamic(
  () => import("../components/Form/RegistrationForm.js"),
  { ssr: false }
);
import { getPrice, isGroupDiscount } from "../utils/functions";
import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Home({ tickets }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  const [isClicked, setIsClicked] = useState(false);

  if (typeof window !== "undefined") {
    localStorage.removeItem("accepted");
  }
  const router = useRouter();

  const form = useFormState({
    values: {
      status: "registered",
      firstname: "",
      lastname: "",
      email: "",
      country: "",
      ticket: "",
      level: "",
      role: "",
      theme_class: "no",
      competition: "",
      competition_role: "",
      competitions: "",
      donation: "",
      donation_amount: 0,
      lunch: "",
      terms: false,
    },

    onValidate: (values) => {
      const errors = {};
      if (!values.firstname) {
        errors.firstname = "please write your name";
      }
      if (!values.lastname) {
        errors.lastname = "please write your name";
      }
      if (!values.terms) {
        errors.terms = "please accept our terms and conditions";
      }
      if (
        !values.email ||
        !emailRegex.test(values.email.trim().toLowerCase())
      ) {
        errors.email = "Email is not valid";
      }
      if (Object.keys(errors).length > 0) {
        throw errors;
      }
    },
    onSubmit: (values) => {
      setIsClicked(true);
      const isDiscount = isGroupDiscount(values.email);
      const totalPrice = getPrice(values, isDiscount); //

      const req = {
        ...form.values,
        totalPrice,
      };

      fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store",
        },
        body: JSON.stringify(req),
      })
        .then((response) => {
          if (response.status === 200) {
            localStorage.setItem("accepted", JSON.stringify(form.values));
            Router.push("/accept");
          }

          if (response.status === 301) {
            Router.push("/soldout");
          }
          if (response.status === 302) {
            Router.push("/alreadyRegistered");
          }
        })
        .catch((error) => console.log(error));
    },
  });
  return (
    <div className={styles.container}>
      <Head>
        <title>Blues Fever 2023</title>
        <meta name="description" content="BLUES FEVER 2022 Registration" />
        <meta
          property="og:image"
          content="https://www.bluesfever.eu/wp-content/uploads/2022/08/bff2022.png"
        />

        <link rel="icon" href="/icon.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300&display=swap"
          rel="stylesheet"
        ></link>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amatic+SC&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Header
        title="BLUES FEVER 2023"
        menuItems={[
          {
            title: "Home",
            link: "https://bluesfever.eu/",
          },
        ]}
      />
      <main className={styles.main}>
        {router?.query?.intern === "true" ? (
          <RegistrationForm
            form={form}
            tickets={tickets}
            isClicked={isClicked}
          />
        ) : (
          <h3>Registration start in August</h3>
        )}
      </main>

      <footer className={styles.footer}>
        <a
          style={{ width: "auto" }}
          href="https://hamedjenabi.me"
          target="_blank"
          rel="noreferrer"
        >
          Made with love by Hamed
        </a>
      </footer>
    </div>
  );
}

export async function getServerSideProps() {
  const { getTickets } = await import("../db/db");
  const tickets = await getTickets();

  return {
    props: {
      tickets: tickets,
    },
  };
}
