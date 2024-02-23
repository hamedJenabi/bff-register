import Head from "next/head";
import useMedia from "use-media";
import Router from "next/router";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { emailRegex } from "../utils/validate";
import styles from "../styles/Home.module.scss";
import Header from "../components/Header/Header.js";
const CompForm = dynamic(() => import("../components/Form/CompForm.js"), {
  ssr: false,
});
import { unstable_useFormState as useFormState } from "reakit/Form";

export default function Home({ tickets, clientID }) {
  const isMobile = useMedia({ maxWidth: "768px" });
  const [isClicked, setIsClicked] = useState(false);
  const [next, setNext] = useState(false);
  const [priceToPay, setPriceToday] = useState(12.5);

  if (typeof window !== "undefined") {
    localStorage.removeItem("accepted");
  }
  const form = useFormState({
    values: {
      firstname: "",
      lastname: "",
      email: "",
      competition_role: "",
      competitions: "",
    },
    onValidate: (values) => {
      const errors = {};
      if (!values.firstname) {
        errors.firstname = "please write your name";
      }
      if (!values.lastname) {
        errors.lastname = "please write your name";
      }
      if (
        !values.email ||
        !emailRegex.test(values.email.trim().toLowerCase())
      ) {
        errors.email = "Email is not valid";
      }
      if (Object.keys(errors).length > 0) {
        throw errors;
      } else {
      }
    },
    onSubmit: (values) => {
      const req = {
        ...form.values,
      };

      fetch("/api/comp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store",
        },
        body: JSON.stringify(req),
      })
        .then((response) => {
          if (response.status === 200) {
            setIsClicked(true);
          }
          if (response.status === 404) {
            alert(
              "we didnt find you in our database, please check your email or contact us"
            );
            setIsClicked(false);
          }
        })
        .catch((error) => console.log(error));
    },
  });
  useEffect(() => {
    if (isClicked) {
      form.submit();
    }
  }, [isClicked]);
  const handleNext = () => {
    if (
      !emailRegex.test(form.values.email.trim().toLowerCase()) ||
      !form.values.firstname ||
      !form.values.lastname
    ) {
      alert("Your info are not valid");
      return;
    }
    const price = form.values.lunch.length === 1 ? 12.5 : 25;
    setPriceToday(price);
    setNext(true);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Blues Fever 2024</title>
        <meta name="description" content="BLUES FEVER 2024 Registration" />
        <meta
          property="og:image"
          content="https://www.bluesfever.eu/wp-content/uploads/2023/07/bff2023-scaled.jpg"
        />

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
        menuItems={[
          {
            title: "Home",
            link: "https://bluesfever.eu/",
          },
        ]}
      />
      <main className={styles.main}>
        {!next && (
          <>
            <CompForm
              form={form}
              tickets={tickets}
              isClicked={isClicked}
              clientID={clientID}
            />
          </>
        )}
        {next && (
          <>
            <h4>Thanks :) </h4>
            {/* <div className={styles.paypal}>
              <Checkout
                value={priceToPay}
                clientID={clientID}
                setIsClicked={setIsClicked}
              />
            </div> */}
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
  const clientID = process.env.PAYPAL_CLIENT_ID;
  const tickets = await getTickets();

  return {
    props: {
      tickets: tickets,
      clientID: clientID,
    },
  };
}
