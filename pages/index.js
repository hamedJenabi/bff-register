import Head from "next/head";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import Router from "next/router";
import { useRouter } from "next/router";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { emailRegex } from "../utils/validate";
import styles from "../styles/Home.module.scss";
const RegistrationForm = dynamic(
  () => import("../components/Form/RegistrationForm.js"),
  { ssr: false },
);
import {
  getPrice,
  isGroupDiscount,
  isAfterTargetDate,
} from "../utils/functions";
import { unstable_useFormState as useFormState } from "reakit/Form";

const REGISTRATION_DRAFT_STORAGE_KEY = "bff_registration_draft";

export default function Home({ tickets, users }) {
  const [isClicked, setIsClicked] = useState(false);
  const [loading, setLoading] = useState(false);
  const isPartypassSoldout =
    users.filter((user) => user.ticket === "partyPass").length >= 92;
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
      voucher: "",
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
      if (!values.level && values.ticket !== "partyPass") {
        errors.level = "please select your Track";
      }
      if (
        values.competition === "yes" &&
        values.competitions.includes("newcomers_mixnmatch") &&
        !values.newcomers_mixnmatch_role
      ) {
        errors.newcomers_mixnmatch_role = "please select your competition role";
      }
      if (
        values.competition === "yes" &&
        values.competitions.includes("open_mixnmatch") &&
        !values.open_mixnmatch_role
      ) {
        errors.open_mixnmatch_role = "please select your competition role";
      }
      if (
        values.competition === "yes" &&
        values.competitions.includes("strictly") &&
        !values.strictly_role
      ) {
        errors.strictly_role = "please select your competition role";
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
      const totalPrice = getPrice(values, isDiscount, values.voucher); //

      const req = {
        ...form.values,
        totalPrice,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("accepted_user", JSON.stringify(req));
      }

      handleCheckout(totalPrice * 100, req, values.voucher);

      // fetch("/api/register", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     "Cache-Control": "no-cache, no-store",
      //   },
      //   body: JSON.stringify(req),
      // })
      //   .then((response) => {
      //     if (response.status === 200) {
      //       localStorage.setItem("accepted_user", JSON.stringify(form.values));
      //       // Router.push("/accept");
      //       handleCheckout(totalPrice * 100);
      //     }

      //     if (response.status === 301) {
      //       Router.push("/soldout");
      //     }
      //     if (response.status === 302) {
      //       Router.push("/alreadyRegistered");
      //     }
      //   })
      //   .catch((error) => console.log(error));
    },
  });
  const handleCheckout = async (price, req, voucher) => {
    setLoading(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      // add price
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price: price,
        user: req,
        voucher: voucher || "",
      }),
    });
    if (res.status === 302) {
      Router.push("/alreadyRegistered");
      return;
    }
    const data = await res.json();
    if (data.url) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
      }
      window.location.href = data.url; // Redirect to Stripe
    }
    setLoading(false);
  };
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
        <title>BLUES FEVER 2026</title>
        <meta name="description" content="BLUES FEVER 2026 Registration" />
        <meta
          property="og:image"
          content="https://www.bluesfever.eu/wp-content/uploads/2024/12/bff_title_25.png"
        />

        <link rel="icon" href="/icon.png" />
      </Head>
      <main className={styles.main}>
        {router?.query?.intern === "true" ||
        (isAfterTargetDate("2026-08-01T12:00:00+01:00") &&
          !isPartypassSoldout) ? (
          <RegistrationForm
            form={form}
            tickets={tickets}
            users={users}
            isClicked={isClicked}
            intern={router?.query?.intern === "true"}
          />
        ) : (
          <div style={{ textAlign: "center", marginTop: "50px" }}>
            <h3>Registration starts on August 1st, 2026 :) </h3>
            <br />
            {/* <UrgeWithPleasureComponent /> */}
          </div>
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
  const { getTickets, getAllUsers } = await import("../db/db");

  const tickets = await getTickets();
  const users = await getAllUsers();

  return {
    props: {
      tickets: tickets,
      users: users,
    },
  };
}
