import React, { useState, useEffect } from "react";
import {
  unstable_Form as Form,
  unstable_FormMessage as FormMessage,
  unstable_FormRadioGroup as FormRadioGroup,
  unstable_FormRadio as FormRadio,
  unstable_FormInput as FormInput,
  unstable_FormSubmitButton as FormSubmitButton,
  unstable_FormCheckbox as FormCheckbox,
  unstable_FormLabel as FormLabel,
} from "reakit/Form";

import classNames from "classnames";

import InfoModal from "../InfoModal/InfoModal";
import { titleCase, compettionsInfo } from "../../utils/functions";
import styles from "./RegistrationForm.module.scss";
import Card from "../Card/Card";
import countries from "../../utils/countries";
import { useDialogState } from "reakit/Dialog";
const flatProps = {
  options: countries.map((option) => option.title),
};

export default function CompForm({ form, tickets, isClicked }) {
  const dialog = useDialogState();
  const disabled = form.values.competitions.includes("newcomers_mixnmatch");
  const complisting = ["strictly", "newcomers_mixnmatch", "open_mixnmatch"];
  const roleNeededComps = complisting.reduce((acc, comp) => {
    return form.values.competitions?.includes(comp) ? [...acc, comp] : acc;
  }, []);

  return (
    <>
      {!isClicked && (
        <>
          <div className={styles.compInfo}>
            <p styles={{ textAlign: "center" }}>
              IMPORTANT: If you have already registered for competitions and
              want to update them, please contact us via
              registration@bluesfever.eu
            </p>
          </div>
          <Form {...form}>
            <h3 className={styles.personalTitle}>Your Personal Data:</h3>

            <FormInput
              required
              {...form}
              label="First Name"
              defaultValue={form.values.firstname}
              className={styles.input}
              name="firstname"
              placeholder="first name"
            />
            <FormMessage
              className={styles.errorMessage}
              {...form}
              name="firstname"
            />
            <FormInput
              {...form}
              required
              label="Last Name"
              defaultValue={form.values.lastname}
              className={styles.input}
              name="lastname"
              placeholder="last name"
            />
            <FormMessage
              className={styles.errorMessage}
              {...form}
              name="lastname"
            />
            <FormInput
              {...form}
              required
              label="E-mail"
              className={styles.input}
              defaultValue={form.values.email}
              name="email"
              placeholder="email"
            />
            <FormMessage
              className={styles.errorMessage}
              {...form}
              name="email"
            />

            <div className={styles.radioGroup}>
              <h3 className={styles.title}>
                Choose your contests:
                <span className={styles.infoText}>
                  <br></br> (€10 per competition - Solo Battle is fully booked)
                </span>
              </h3>
              {compettionsInfo.map(({ value, label }) => {
                if (value === "solo_battle") return null;
                return (
                  <label>
                    <FormCheckbox {...form} name="competitions" value={value} />{" "}
                    {label}
                  </label>
                );
              })}
            </div>
            <div className={styles.radioGroup}>
              {roleNeededComps.map((comp) => (
                <div className={styles.radioGroup}>
                  <h4 className={styles.title}>
                    Your role in the{" "}
                    <span style={{ fontSize: "13px" }}>{titleCase(comp)}</span>{" "}
                    competition:
                  </h4>
                  <FormRadioGroup
                    className={styles.radioGroup}
                    {...form}
                    name={`${comp}_role`}
                  >
                    <label>
                      <FormRadio
                        {...form}
                        name={`${comp}_role`}
                        value="follow"
                        disabled={comp === "newcomers_mixnmatch"}
                      />
                      <p>
                        {comp === "newcomers_mixnmatch"
                          ? "Follow - fully booked"
                          : "Follow"}
                      </p>
                    </label>

                    <label>
                      <FormRadio {...form} name={`${comp}_role`} value="lead" />
                      <p>Lead</p>
                    </label>
                  </FormRadioGroup>
                </div>
              ))}
            </div>
            <FormMessage
              className={styles.errorMessage}
              {...form}
              name="terms"
            />
            <FormSubmitButton
              disabled={isClicked}
              className={classNames(styles.button, {
                [styles.disabled]: isClicked,
              })}
              {...form}
            >
              Submit
            </FormSubmitButton>
          </Form>
        </>
      )}
      {isClicked && (
        <>
          <h4 style={{ textAlign: "center" }}>
            Thank you for your reply. You will pay the amount at the Event :){" "}
            <br />
            See you in Vienna{" "}
          </h4>
        </>
      )}
    </>
  );
}
