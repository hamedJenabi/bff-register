import React from "react";
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

  // const getTicketCapacity = (ticketName) => {
  //   if (ticketName === "partyPass") {
  //     const [ticket] = tickets.filter(({ name }) => name === ticketName);
  //     return ticket["capacity"];
  //   }
  // };
  // const disabled = (value) =>
  //   (form.values.role === "follow" &&
  //     (value === "drums" || value === "guitar" || value === "saxophone")) ||
  //   (form.values.role === "lead" && value === "trumpet");

  return (
    <>
      {!isClicked && (
        <Form className={styles.container} {...form}>
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
              {/* PUT PRICE HERE */}
              {/* 4 plus pre party */}
              <h3>Full pass</h3>
              <p>6 hours classes</p>
              <p>1 free competition</p>
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
                onClick={() => form.update("level", "")}
              >
                <label>
                  <FormRadio {...form} name="role" value="follow" />{" "}
                  <p>Mainly follower</p>
                </label>
                <label>
                  <FormRadio {...form} name="role" value="lead" />
                  <p> Mainly leader</p>
                </label>
                <label>
                  <FormRadio {...form} name="role" value="both" />
                  <p> Both</p>

                  {/* <InfoModal header="both" info="whatever" /> */}
                </label>
                <div className={styles.infoTextWrapper}>
                  <p className={styles.infoText}>
                    You choose <strong>"Both"</strong> role if you will attend
                    some classes as LEAD and some as FOLLOW to help balance out
                    the ration between the two roles.
                  </p>
                </div>
              </FormRadioGroup>
            </>
          )}
          {form.values.ticket === "fullpass" && (
            <>
              <h3 className={styles.title}>Choose your Level:</h3>
              <div className={styles.infoTextWrapper}>
                <div className={styles.infoText}>
                  Hey folks, There will be <strong>no audition</strong> for
                  Beginner/Intermediate, Intermediate and Intermediate/Advanced
                  levels during the weekend, so please read the level
                  description carefully.{" "}
                  <a
                    style={{ color: "blue" }}
                    target="_blank"
                    href="https://www.bluesfever.eu/passes-levels/#level"
                  >
                    more info here
                  </a>
                  <br /> You <strong>Advanced people! </strong>There will be an
                  audition on Friday afternoon.
                </div>
              </div>

              <FormRadioGroup
                className={styles.radioGroup}
                {...form}
                name="level"
              >
                {levelsToShow.map(({ label, value, detail }) => (
                  <label key={value}>
                    <FormRadio {...form} name="level" value={value} />
                    <p>{label}</p>
                    {/* <InfoModal header={label} info={detail} /> */}
                  </label>
                ))}
              </FormRadioGroup>
            </>
          )}

          <h3 className={styles.title}>Themed Classes? (€45)</h3>
          <p className={styles.infoText}>
            You can add this classes to your Full-or Partypass. (Happening on
            Friday afternoon)
          </p>
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
              />
              <p>Teacher Training</p>
            </label>
            <label>
              <FormRadio {...form} name="theme_class" value="no" />
              <p>No</p>
            </label>
          </FormRadioGroup>
          <h3 className={styles.title}>
            Do you want to participate in competitions?
          </h3>
          <div className={styles.infoTextWrapper}>
            <p className={styles.infoText}>(€10 per competition)</p>
          </div>
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
            <div className={styles.infoTextWrapper}>
              <p className={styles.infoText}>
                You can decide later if you want to participate in the
                competitions. We will send you an email around October. You will
                have to pay the competition fee at the door.
              </p>
            </div>
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
              <h3 className={styles.title}>
                Choose your contests:
                <span className={styles.infoText}>
                  <br></br> (€10 per competition)
                </span>
              </h3>
              {compettionsInfo.map(({ value, label }) => (
                <label>
                  <FormCheckbox
                    {...form}
                    name="competitions"
                    key={label}
                    value={value}
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
          )}
          <div className={styles.radioGroup}>
            <h4 className={styles.title}>
              Which day you wanto to have lunch at the Venue? <br />
              (You can choose both days):
            </h4>
            <p className={styles.infoText}>
              Price: €15 per meal - main course + dessert + one drink. <br />
              There are vegan/vegetarian and gluten-free options
            </p>

            <label>
              <FormCheckbox {...form} name="lunch" value="saturday" /> Saturday
              Lunch
            </label>
            <label>
              <FormCheckbox {...form} name="lunch" value="sunday" /> Sunday
              Lunch
            </label>
          </div>
          <h4 className={styles.title}>
            Do you want to donate to the Blues Fever Scholarship and discount
            Fund?
          </h4>
          <div className={styles.infoTextWrapper}>
            <p className={styles.infoText}>
              By donating you will help us to make Blues Fever more accessible
              to everyone. You can donate any amount you want.
            </p>
          </div>
          <FormRadioGroup
            className={styles.radioGroup}
            {...form}
            name="donation"
          >
            <label>
              <FormRadio {...form} name="donation" value="yes" />
              <p>Yes</p>
            </label>
            <label>
              <FormRadio {...form} name="donation" value="no" />
              <p>No</p>
            </label>
          </FormRadioGroup>
          {form.values.donation === "yes" && (
            <div className={styles.radioGroup}>
              <h4 className={styles.title}>How much do you want to donate?</h4>
              <FormInput
                className={styles.input}
                {...form}
                name="donation_amount"
                type="number"
                placeholder="€"
              />
            </div>
          )}
          <div className={styles.checkboxWrapper}>
            <FormCheckbox {...form} name="terms" />
            <FormLabel className={styles.infoText} {...form} name="terms">
              By accepting this, you agree to our{" "}
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
