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
import SkeletonComponent from "../Skeleton/Skeleton";

import classNames from "classnames";

import InfoModal from "../InfoModal/InfoModal";
import { levelsToShow, compettionsInfo } from "../../utils/functions";
import styles from "./RegistrationForm.module.scss";
import countries from "../../utils/countries";
import { useDialogState } from "reakit/Dialog";
const flatProps = {
  options: countries.map((option) => option.title),
};

export default function RegistrationForm({ form, tickets, isClicked }) {
  const dialog = useDialogState();
  const handleTicket = (ticket) => {
    if (ticket === 1) {
      form.update("ticket", "fullpass");
    } else {
      form.update("ticket", "partyPass");
      form.update("role", "");
      form.update("level", "");
    }
  };

  const getTicketCapacity = (ticketName) => {
    if (ticketName === "partyPass") {
      const [ticket] = tickets.filter(({ name }) => name === ticketName);
      return ticket["capacity"];
    }
  };

  return (
    <>
      {!isClicked && (
        <Form className={styles.container} {...form}>
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
          <select
            onChange={(e) => form.update("country", e.target.value)}
            className={classNames(styles.select, styles.countrySelect)}
          >
            {countries?.map(({ title }) => (
              <option value={title} key={title}>
                {title}
              </option>
            ))}
          </select>

          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="country"
          />
          <h3 className={styles.title}>Choose your Ticket:</h3>
          <div className={styles.cardWrapper}>
            <div
              onClick={() => handleTicket(1)}
              className={classNames(styles.card, {
                [styles.selected]: form.values.ticket === "fullpass",
              })}
            >
              <h3>Full pass</h3>
              <p>6 hours classes</p>
              <p>All 5 Parties</p>
              <p>All Talks</p>
            </div>
            <div
              onClick={() => handleTicket(2)}
              className={classNames(styles.card, {
                [styles.selected]: form.values.ticket === "partyPass",
              })}
            >
              <h3>Party Pass</h3>
              <p>All 5 Parties</p>
              <p>All Talks</p>
            </div>
          </div>
          {form.values.ticket === "fullpass" && (
            <>
              <h3 className={styles.title}>Choose your dance role:</h3>
              <FormRadioGroup
                className={styles.radioGroup}
                {...form}
                name="role"
              >
                <label>
                  <FormRadio {...form} name="role" value="follow" />{" "}
                  <p>Mainly follower</p>
                </label>
                <label>
                  <FormRadio {...form} name="role" value="lead" />
                  <p> Mainly leader</p>
                </label>
              </FormRadioGroup>
            </>
          )}
          {form.values.ticket === "fullpass" && (
            <>
              <h3 className={styles.title}>Choose your Level:</h3>
              <FormRadioGroup
                className={styles.radioGroup}
                {...form}
                name="level"
              >
                {levelsToShow.map(({ label, value, detail }) => (
                  <label key={value}>
                    <FormRadio {...form} name="level" value={value} />
                    <p>
                      {label}{" "}
                      {form.values.role === "follow" &&
                      (value === "trumpet" ||
                        value === "drums" ||
                        value === "guitar")
                        ? "(Waiting List)"
                        : ""}
                    </p>
                    <InfoModal header={label} info={detail} />
                  </label>
                ))}
              </FormRadioGroup>
            </>
          )}

          <h3 className={styles.title}>
            Themed Classes on Friday Afternoon? (€40)
          </h3>
          <FormRadioGroup
            className={styles.radioGroup}
            {...form}
            name="theme_class"
          >
            <label>
              <FormRadio
                {...form}
                name="theme_class"
                value="build_a_chreography"
              />
              <p>Build a Choreography </p>
            </label>
            <label>
              <FormRadio
                {...form}
                name="theme_class"
                value="teacher_training"
                disabled
              />
              <p>Teacher Training (fully booked)</p>
            </label>
            <label>
              <FormRadio {...form} name="theme_class" value="no" />
              <p>No</p>
            </label>
          </FormRadioGroup>
          <h3 className={styles.title}>
            Do you want to participate in competitions?
          </h3>
          <FormRadioGroup
            className={styles.radioGroup}
            {...form}
            name="competition"
          >
            <label>
              <FormRadio {...form} name="competition" value="yes" />
              <p>Yes</p>
            </label>

            <label>
              <FormRadio {...form} name="competition" value="no" />
              <p>No</p>
            </label>
            <label>
              <FormRadio {...form} name="competition" value="later" />
              <p>I will decide later</p>
            </label>
          </FormRadioGroup>
          {form.values.competition === "yes" && (
            <div className={styles.radioGroup}>
              <h3 className={styles.title}>Your role in the competition:</h3>
              <FormRadioGroup
                className={styles.radioGroup}
                {...form}
                name="competition_role"
              >
                <label>
                  <FormRadio {...form} name="competition_role" value="follow" />
                  <p>Follow</p>
                </label>

                <label>
                  <FormRadio {...form} name="competition_role" value="lead" />
                  <p>Lead</p>
                </label>
              </FormRadioGroup>
            </div>
          )}
          {form.values.competition === "yes" && (
            <div className={styles.radioGroup}>
              <h3 className={styles.title}>Choose your contests:</h3>
              {compettionsInfo.map(({ value, label }) => (
                <label>
                  <FormCheckbox {...form} name="competitions" value={value} />{" "}
                  {label}
                </label>
              ))}
            </div>
          )}
          <div className={styles.checkboxWrapper}>
            <FormCheckbox {...form} name="terms" />
            <FormLabel {...form} name="terms">
              By accepting this you agree to our{" "}
              <a
                style={{ color: "blue" }}
                rel="noreferrer"
                href="https://www.bluesfever.eu/terms-conditions/"
                target="_blank"
              >
                Terms and Conditions
              </a>{" "}
              and{" "}
              <a
                style={{ color: "blue" }}
                rel="noreferrer"
                href="https://www.bluesfever.eu/code-of-conduct/"
                target="_blank"
              >
                Code of Conduct.
              </a>
            </FormLabel>
          </div>
          <FormMessage className={styles.errorMessage} {...form} name="terms" />
          <FormSubmitButton
            disabled={isClicked}
            className={classNames(styles.button, {
              [styles.disabled]: isClicked,
            })}
            {...form}
          >
            Register
          </FormSubmitButton>
        </Form>
      )}
      {isClicked && <SkeletonComponent />}
    </>
  );
}
