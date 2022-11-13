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

export default function FoodForm({ form, tickets, isClicked }) {
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
            <h4 className={styles.title}>
              Which day you wanto to have lunch at the Venue? <br></br>(You can
              choose both days):
              <span style={{ fontSize: "15px" }}>
                <br></br> (€12.50 per meal - main course + dessert + one drink)
              </span>
            </h4>

            <label>
              <FormCheckbox {...form} name="lunch" value="saturday" /> Saturday
              Lunch
            </label>
            <label>
              <FormCheckbox {...form} name="lunch" value="sunday" /> Sunday
              Lunch
            </label>
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
          <h4>Thank you for your reply. See you in Vienna </h4>
        </>
      )}
    </>
  );
}
