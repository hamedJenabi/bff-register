import Head from "next/head";
import useMedia from "use-media";
import Router from "next/router";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import styles from "./login.module.scss";
import Header from "../../components/Header/Header.js";
import {
  unstable_Form as Form,
  unstable_FormMessage as FormMessage,
  unstable_FormInput as FormInput,
  unstable_FormSubmitButton as FormSubmitButton,
  unstable_useFormState as useFormState,
} from "reakit/Form";

export default function Admin({ tickets }) {
  const isMobile = useMedia({ maxWidth: "768px" });

  if (typeof window !== "undefined") {
    const admin = localStorage.getItem("login_admin");
    if (admin === "true") {
      Router.push("/dashboard/fdjhfdskjfhdskjh");
    }
  }

  const form = useFormState({
    values: {
      userName: "",
      password: "",
    },
    onValidate: (values) => {
      const errors = {};
      if (!values.userName) {
        errors.firstName = "please write your username";
      }
      if (!values.password) {
        errors.lastName = "please write your password";
      }
      if (Object.keys(errors).length > 0) {
        throw errors;
      }
    },
    onSubmit: () => {
      fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store",
        },
        body: JSON.stringify(form.values),
      })
        .then((response) => {
          if (response.status === 200) {
            localStorage.setItem("login_admin", true);
            Router.push("/dashboard/fdjhfdskjfhdskjh");
          }
          if (response.status === 401) {
            alert("Wrong username or password");
          }
        })
        .catch((error) => console.log(error));
    },
  });
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
        {" "}
        <Form className={styles.container} {...form}>
          <h3 className={styles.personalTitle}>Admin Login:</h3>

          <FormInput
            required
            {...form}
            label="User Name"
            className={styles.input}
            name="userName"
            placeholder="username"
          />
          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="userName"
          />
          <FormInput
            {...form}
            required
            label="password"
            className={styles.input}
            name="password"
            placeholder="password"
            type="password"
          />
          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="password"
          />
          <FormSubmitButton className={styles.button} {...form}>
            Login
          </FormSubmitButton>
        </Form>
      </main>
    </div>
  );
}

// export async function getServerSideProps() {
//   const { getTickets } = await import("../db/db");
//   const tickets = await getTickets();
//   return {
//     props: {
//       tickets: tickets,
//     },
//   };
// }
