import Head from "next/head";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import Router from "next/router";
import { useRouter } from "next/router";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { emailRegex } from "../utils/validate";
import styles from "../styles/Home.module.scss";
import Header from "../components/Header/Header.js";
const RegistrationForm = dynamic(
  () => import("../components/Form/RegistrationForm.js"),
  { ssr: false }
);
import {
  getPrice,
  isGroupDiscount,
  isAfterTargetDate,
} from "../utils/functions";
import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Home({ tickets }) {
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
      parent_partner: "",
      level: "",
      role: "",
      theme_class: "no",
      competition: "",
      open_mixnmatch_role: "",
      newcomers_mixnmatch_role: "",
      strictly_role: "",
      tshirtInfo: "",
      tshirt: "",
      competitions: "",
      donation: "",
      donation_amount: "",
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
      if (form.values.ticket === "") {
        alert("Please select a ticket");
        window.scrollTo({ top: 140, behavior: "smooth" });

        return;
      }
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

  const isAfterTargetDateValue = isAfterTargetDate("2024-07-07T19:00:00+02:00");

  const targetDate = new Date("2024-07-07T19:00:00+02:00").getTime();

  const calculateRemainingTime = () => {
    const currentTime = new Date().getTime();
    const difference = targetDate - currentTime;
    return Math.max(Math.floor(difference / 1000), 0);
  };
  const [remainingTime, setRemainingTime] = useState(calculateRemainingTime());

  useEffect(() => {
    let interval;
    if (isAfterTargetDateValue) {
      return;
    }
    interval = setInterval(() => {
      setRemainingTime(calculateRemainingTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const UrgeWithPleasureComponent = () => {
    const children = () => {
      const hours = Math.floor(remainingTime / 3600)
        .toString()
        .padStart(2, "0");
      const minutes = Math.floor((remainingTime % 3600) / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (remainingTime % 60).toString().padStart(2, "0");

      return (
        <p>
          {hours}:{minutes}:{seconds}
        </p>
      );
    };

    return (
      <CountdownCircleTimer
        isPlaying
        colors={["#004777", "#F7B801", "#A30000", "#A30000"]}
        colorsTime={[
          remainingTime,
          remainingTime * 0.9,
          remainingTime * 0.3,
          0,
        ]}
      >
        {children}
      </CountdownCircleTimer>
    );
  };
  return (
    <div className={styles.container}>
      <Head>
        <title>Blues Fever 2024</title>
        <meta name="description" content="BLUES FEVER 2024 Registration" />
        <meta
          property="og:image"
          content="https://www.bluesfever.eu/wp-content/uploads/2024/01/bff24_title-finals-2-scaled.jpg"
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
        title="BLUES FEVER 2024"
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
          <>
            <h3>Registration starts on August 2nd:) </h3>
            <br />
            {/* <UrgeWithPleasureComponent /> */}
          </>
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
