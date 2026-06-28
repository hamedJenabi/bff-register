import Head from "next/head";
import Link from "next/link";
import Router from "next/router";
import React, { useEffect, useState } from "react";
import styles from "./user.module.scss";
import { MANUAL_STATUS_OPTIONS } from "../../../utils/dashboard.mjs";

const dashboardPath = "/dashboard/fdjhfdskjfhdskjh";

const textFields = [
  ["firstname", "First name"],
  ["lastname", "Last name"],
  ["email", "Email"],
  ["country", "Country"],
  ["ticket", "Ticket"],
  ["level", "Track"],
  ["role", "Role"],
  ["parent_partner", "Parent partner"],
  ["competition", "Competition answer"],
  ["competitions", "Competitions"],
  ["open_mixnmatch_role", "Open MixMatch role"],
  ["newcomers_mixnmatch_role", "Newcomers MixMatch role"],
  ["strictly_role", "Strictly role"],
  ["tshirt", "T-shirt"],
  ["lunch", "Lunch"],
];

const moneyFields = [
  ["price", "Price"],
  ["to_pay", "To pay"],
  ["donation", "Donation"],
];

function normalizeUser(user) {
  return {
    id: user.id,
    status: user.status || "registered",
    prevStatus: user.status || "registered",
    firstname: user.firstname || "",
    lastname: user.lastname || "",
    email: user.email || "",
    country: user.country || "",
    ticket: user.ticket || "",
    level: user.level || "",
    role: user.role || "",
    parent_partner: user.parent_partner || "",
    competition: user.competition || "",
    open_mixnmatch_role: user.open_mixnmatch_role || "",
    newcomers_mixnmatch_role: user.newcomers_mixnmatch_role || "",
    strictly_role: user.strictly_role || "",
    competitions: user.competitions || "",
    price: user.price || "",
    to_pay: user.to_pay || "",
    donation: user.donation || "",
    tshirt: user.tshirt || "",
    lunch: user.lunch || "",
    terms: Boolean(user.terms),
  };
}

export default function User({ user }) {
  const [formValues, setFormValues] = useState(() => normalizeUser(user));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const admin = window.localStorage.getItem("login_admin");

    if (admin !== "true") {
      Router.push("/login/admin");
    }
  }, []);

  const updateField = (field, value) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const saveUser = async (overrides = {}, successMessage = "Saved.") => {
    setIsSaving(true);
    setNotice("");

    const payload = {
      ...formValues,
      ...overrides,
      id: user.id,
      prevStatus: user.status,
    };

    const response = await fetch("/api/edituser?action=edit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
      },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);

    if (response.status === 200) {
      setNotice(successMessage);
      Router.replace(Router.asPath);
      return;
    }

    setNotice("Could not save this registration.");
  };

  const sendEmail = async () => {
    if (
      !window.confirm(
        `Send the final email to ${formValues.firstname} ${formValues.lastname}?`,
      )
    ) {
      return;
    }

    const response = await fetch("/api/mailall", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
      },
      body: JSON.stringify(formValues),
    });

    setNotice(response.status === 200 ? "Email request sent." : "Email failed.");
  };

  const fullName = `${user.firstname} ${user.lastname}`.trim();

  return (
    <div className={styles.container}>
      <Head>
        <title>{fullName || "Registration"} · BFF Dashboard</title>
        <meta name="description" content="Blues Fever registration admin" />
        <link rel="icon" href="/icon.png" />
      </Head>

      <header className={styles.topBar}>
        <Link className={styles.backLink} href={dashboardPath}>
          Back to dashboard
        </Link>
        <button
          className={styles.ghostButton}
          onClick={() => {
            window.localStorage.removeItem("login_admin");
            Router.push("/login/admin");
          }}
        >
          Log out
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Registration #{user.id}</p>
            <h1>{fullName || "Unnamed attendee"}</h1>
            <p>{user.email}</p>
          </div>
          <span className={styles.statusBadge}>{formValues.status}</span>
        </section>

        <section className={styles.actions}>
          <button
            className={styles.primaryButton}
            disabled={isSaving}
            onClick={() => saveUser()}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
          <button
            className={styles.secondaryButton}
            disabled={isSaving}
            onClick={() =>
              saveUser({ status: "canceled" }, "Registration canceled in DB.")
            }
          >
            Cancel registration
          </button>
          <button
            className={styles.secondaryButton}
            disabled={isSaving}
            onClick={() =>
              saveUser({ status: "confirmed" }, "Marked confirmed in DB.")
            }
          >
            Mark confirmed
          </button>
          {formValues.status === "waitinglist" && (
            <button
              className={styles.secondaryButton}
              disabled={isSaving}
              onClick={() =>
                saveUser(
                  { status: "registered" },
                  "Moved from waiting list to registered.",
                )
              }
            >
              Promote to registered
            </button>
          )}
          <button className={styles.ghostButton} onClick={sendEmail}>
            Send email
          </button>
        </section>

        {notice && <p className={styles.notice}>{notice}</p>}

        <section className={styles.formPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Database-only editor</p>
              <h2>Attendee details</h2>
            </div>
            <p>
              Status and payment labels here update your app database only. They
              do not refund, cancel, or mutate Stripe.
            </p>
          </div>

          <div className={styles.formGrid}>
            <label>
              Status
              <select
                value={formValues.status}
                onChange={(event) => updateField("status", event.target.value)}
              >
                {MANUAL_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            {textFields.map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  value={formValues[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              </label>
            ))}

            {moneyFields.map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  inputMode="numeric"
                  value={formValues[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              </label>
            ))}

            <label className={styles.checkboxLabel}>
              <input
                checked={formValues.terms}
                type="checkbox"
                onChange={(event) => updateField("terms", event.target.checked)}
              />
              Terms accepted
            </label>
          </div>
        </section>
      </main>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { id } = params;
  const { getUserById } = await import("../../../db/db");
  const user = await getUserById(id);

  return {
    props: {
      user,
    },
  };
}
