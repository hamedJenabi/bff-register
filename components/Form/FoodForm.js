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
          <FormMessage className={styles.errorMessage} {...form} name="email" />

          <div className={styles.radioGroup}>
            <h4 className={styles.title}>
              Which day you wanto to have lunch at the Venue? <br></br>(You can
              choose both days):
              <span style={{ fontSize: "12px" }}>
                <br></br> Price: €12.50 per meal - main course + dessert + one
                drink
                <br></br> There are vegan/vegetarian and gluten-free options
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
