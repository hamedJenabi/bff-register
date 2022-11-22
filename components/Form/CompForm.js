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
import { levelsToShow, compettionsInfo } from "../../utils/functions";
import styles from "./RegistrationForm.module.scss";
import Card from "../Card/Card";
import countries from "../../utils/countries";
import { useDialogState } from "reakit/Dialog";
const flatProps = {
  options: countries.map((option) => option.title),
};

export default function CompForm({ form, tickets, isClicked }) {
  const dialog = useDialogState();

  return (
    <>
      {!isClicked && (
        <Form {...form}>
          <h3 className={styles.personalTitle}>Your Personal Data:</h3>

          <FormInput
            required
            {...form}
            label="First Name"
            defaultValue={form.values.firstName}
            className={styles.input}
            name="firstName"
            placeholder="first name"
          />
          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="firstName"
          />
          <FormInput
            {...form}
            required
            label="Last Name"
            defaultValue={form.values.lastName}
            className={styles.input}
            name="lastName"
            placeholder="last name"
          />
          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="lastName"
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
          <FormMessage className={styles.errorMessage} {...form} name="email" />
          <div className={styles.radioGroup}>
            <h3 className={styles.title}>Your role in the competition:</h3>
            <FormRadioGroup
              className={styles.radioGroup}
              {...form}
              name="competition_role"
            >
              <label>
                <FormRadio
                  {...form}
                  name="competition_role"
                  value="follow"
                  disabled
                />
                <p>Follow (Fully Booked)</p>
              </label>

              <label>
                <FormRadio {...form} name="competition_role" value="lead" />
                <p>Lead</p>
              </label>
            </FormRadioGroup>
          </div>
          <div className={styles.radioGroup}>
            <h3 className={styles.title}>
              Choose your contests:
              <span style={{ fontSize: "15px" }}>
                <br></br> (€10 per competition - Strictly is fully booked)
              </span>
            </h3>
            {compettionsInfo.map(({ value, label }) => (
              <label>
                <FormCheckbox {...form} name="competitions" value={value} />{" "}
                {label}
              </label>
            ))}
          </div>
          <FormMessage className={styles.errorMessage} {...form} name="terms" />
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
