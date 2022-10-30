import Head from "next/head";
import useMedia from "use-media";
import Router from "next/router";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./dancerLogin.module.scss";
import Header from "../../components/Header/Header.js";
import {
  unstable_Form as Form,
  unstable_FormMessage as FormMessage,
  unstable_FormInput as FormInput,
  unstable_FormSubmitButton as FormSubmitButton,
  unstable_useFormState as useFormState,
} from "reakit/Form";

export default function Admin({ users }) {
  const [email, setEmail] = useState("");
  const isMobile = useMedia({ maxWidth: "768px" });

  const form = useFormState({
    values: {
      email: email,
      password: "",
      password1: "",
    },
    onValidate: (values) => {
      const errors = {};
      if (values.password1 !== values.password) {
        errors.password = "Password doesn't match";
      }
      if (Object.keys(errors).length > 0) {
        throw errors;
      }
    },
    onSubmit: () => {
      const req = {
        email: email,
        password: form.values.password,
      };
      fetch("/api/dancerpassword", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store",
        },
        body: JSON.stringify(req),
      })
        .then((response) => {
          if (response.status === 200) {
            // localStorage.setItem("login_dancer", true);
            Router.push("/dancer/dashboard/fsadsflkj34sgldsajf5423hdskjh");
          }
          if (response.status === 401) {
            alert("Wrong username or password");
          }
        })
        .catch((error) => console.log(error));
    },
  });

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("email");
    setEmail(param);
  }, [form]);

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
        menuItems={[{ title: "Home", link: "https://bluesfever.eu" }]}
      />
      <main className={styles.main}>
        {" "}
        <Form className={styles.container} {...form}>
          <h3 className={styles.personalTitle}>Dancer Login:</h3>

          <FormInput
            {...form}
            className={styles.input}
            name="email"
            value={email}
            placeholder="email"
          />
          <FormInput
            {...form}
            required
            label="password"
            className={styles.input}
            name="password1"
            placeholder="password"
            type="password"
          />
          <FormInput
            {...form}
            required
            label="Repeat password"
            className={styles.input}
            name="password"
            placeholder="repeat password"
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

export async function getServerSideProps() {
  const { getAllUsers } = await import("../../db/db");
  const users = await getAllUsers();
  console.log("users", users);
  return {
    props: {
      users: users,
    },
  };
}
