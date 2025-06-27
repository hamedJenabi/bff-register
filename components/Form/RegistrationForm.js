import React, { useState } from "react";
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
import { useRouter } from "next/router";
import classNames from "classnames";
import CheckoutButton from "../CheckoutButton/CheckoutButton";
import InfoModal from "../InfoModal/InfoModal";
import {
  levelsToShow,
  SoloLevelToShow,
  compettionsInfo,
  fullpassPrice,
  partyPrice,
  titleCase,
  isAfterTargetDate,
} from "../../utils/functions";
import styles from "./RegistrationForm.module.scss";
import countries from "../../utils/countries";

export default function RegistrationForm({ form, isClicked }) {
  const handleTicket = (ticket) => {
    if (ticket === 1) {
      form.update("ticket", "fullpass");
    } else if (ticket === 3) {
      form.update("ticket", "parentPass");
    } else if (ticket === 4) {
      form.update("ticket", "solo");
    } else {
      form.update("ticket", "partyPass");
      form.update("role", "");
      form.update("level", "");
    }
  };
  const isRoleNeeded =
    form.values.competitions?.includes("strictly") ||
    form.values.competitions?.includes("newcomers_mixnmatch") ||
    form.values.competitions?.includes("open_mixnmatch");

  const complisting = ["strictly", "newcomers_mixnmatch", "open_mixnmatch"];
  const roleNeededComps = complisting.reduce((acc, comp) => {
    return form.values.competitions?.includes(comp) ? [...acc, comp] : acc;
  }, []);
  const isFullPass =
    form.values.ticket === "fullpass" || form.values.ticket === "parentPass";
  // const isSolo = form.values.ticket === "solo";
  const noTeacher =
    form.values.level === "int" ||
    form.values.level === "beg/int" ||
    form.values.level === "struttin";

  const shirtSize = [
    "",
    "Curvy XS (W)",
    "Curvy S (W)",
    "Curvy M (W)",
    "Curvy L (W)",
    "Curvy XL (W)",
    "Curvy 2XL (W)",
    "Croptop S",
    "Croptop M",
    "Croptop L",
    "Straight S (M)",
    "Straight M (M)",
    "Straight L (M)",
    "Straight XL (M)",
    "Straight 2XL (M)",
  ];
  const isDisabled = (value) => false;
  // value === "beg/int" ||
  // value === "int" ||
  // value === "adv" ||
  // value === "adv+" ||
  // value === "chicago_triple" ||
  // (value === "struttin" && form.values.role === "follow") ||
  // (value === "stride_strut" && form.values.role === "follow") ||
  // (value === "latin_blues" && form.values.role === "follow");

  //   value === "int" ||
  //   value === "latin_blues" ||
  //   value === "stride_strut" ||

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
              {/* 4 plus pre party */}
              <h3>Full pass </h3>
              <p>6+ hours partner classes</p>
              <p>1 free competition</p>
              <p>All 5 Parties</p>
              <p>€{fullpassPrice}</p>
            </div>
            {/* <div
              onClick={() => handleTicket(4)}
              className={classNames(styles.card, {
                [styles.selected]: form.values.ticket === "solo",
              })}
            >

              <h3>Solo pass</h3>
              <p>6+ hours of solo classes</p>
              <p>1 free competition</p>
              <p>All 5 Parties</p>
              <p>€{fullpassPrice}</p>
            </div> */}

            {isAfterTargetDate("2025-08-16T00:12:00+02:00") && (
              <div
                onClick={() => handleTicket(2)}
                className={classNames(styles.card, {
                  [styles.selected]: form.values.ticket === "partyPass",
                })}
              >
                <h3>Party Pass</h3>
                <h4>(sold out)</h4>
                <p>All 5 Parties</p>
                <p>€{partyPrice}</p>
              </div>
            )}
            <div
              onClick={() => handleTicket(3)}
              className={classNames(styles.card, {
                [styles.selected]: form.values.ticket === "parentPass",
              })}
            >
              <h3>Parent Pass </h3>
              <p className={styles.infoText}>
                Two dancers sharing a child-care
              </p>
              <p>6+ hours classes</p>
              <p>All 5 Parties</p>
              <p>€{partyPrice}</p>
            </div>
          </div>
          {form.values.ticket === "parentPass" && (
            <div className={styles.radioGroup}>
              <h4 className={styles.title}>
                Who is your parent partner? (full name)
              </h4>
              <FormInput
                className={styles.input}
                {...form}
                name="parent_partner"
              />
            </div>
          )}

          {isFullPass && (
            <>
              <h3 className={styles.title}>
                Choose your Track: (classes on Fr/Sat/Sunday)
              </h3>
              <div className={styles.infoTextWrapper}>
                <div className={styles.infoText}>
                  Hey folks, There will be <strong>no audition</strong>,so
                  please read the level description carefully.{" "}
                  <a
                    style={{ color: "blue" }}
                    target="_blank"
                    href="https://www.bluesfever.eu/passes-levels/#level"
                  >
                    more info here
                  </a>
                  <br />
                  {/* *** Please consider that <strong>Idiom Tracks</strong> are for
                  Int/Advanced and above. **** */}
                </div>
              </div>

              <FormRadioGroup
                className={styles.radioGroup}
                {...form}
                name="level"
              >
                {levelsToShow.map(({ label, value, detail }) => {
                  return (
                    <label key={value}>
                      <FormRadio
                        {...form}
                        name="level"
                        value={value}
                        disabled={isDisabled(value)}
                      />
                      <p style={{ fontSize: "14px" }}>
                        {label}
                        {isDisabled(value) && " (Sold out)"}
                      </p>
                      {/* <InfoModal header={label} info={detail} /> */}
                    </label>
                  );
                })}
              </FormRadioGroup>
            </>
          )}
          {isFullPass &&
            form.values.level !== "" &&
            form.values.level !== "solo" && (
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
                      some classes as LEAD and some as FOLLOW to help balance
                      out the ration between the two roles.
                    </p>
                  </div>
                </FormRadioGroup>
              </>
            )}

          {/* <h3 className={styles.title}>Themed Classes? (€45)</h3>
          <p className={styles.infoText}>
            You can add this class to your Full-or Partypass. (Happening on
            Friday afternoon)
          </p>
          <FormRadioGroup
            className={styles.radioGroup}
            {...form}
            name="theme_class"
          > */}
          {/* <label>
              <FormRadio
                {...form}
                name="theme_class"
                value="build_a_chreography"
              />
              <p>Build a Choreography </p>
            </label> */}
          {/* <label>
              <FormRadio
                disabled
                {...form}
                name="theme_class"
                value="teacher_training"
              />
              <p>Teacher Training (fully booked)</p>
            </label>
            <label>
              <FormRadio {...form} name="theme_class" value="no" />
              <p>No</p>
            </label> */}
          {/* </FormRadioGroup> */}
          <h3 className={styles.title}>
            Do you want to participate in competitions?
          </h3>
          <div className={styles.infoTextWrapper}></div>
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
              <h3 className={styles.title}>
                Choose your contests:
                <span className={styles.infoText}>
                  <br></br> (€10 per competition - one free comp for Full Pass
                  Holders)
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
          {form.values.competition === "yes" && isRoleNeeded && (
            <>
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
                      />
                      <p>Follow</p>
                    </label>

                    <label>
                      <FormRadio {...form} name={`${comp}_role`} value="lead" />
                      <p>Lead</p>
                    </label>
                  </FormRadioGroup>
                </div>
              ))}
            </>
          )}
          {/* <div className={styles.radioGroup}>
            <h4 className={styles.title}>
              Which day do you want to have lunch at the Venue? <br />
              (You can choose both days):
            </h4>
            <p className={styles.infoText}>
              Price: €15 per meal - main course + dessert + one drink. <br />
              There are vegan/vegetarian and gluten-free options-{" "}
              <a
                style={{ color: "blue" }}
                target="_blank"
                href="https://www.bluesfever.eu/passes-levels/#schedule"
              >
                Schedule here
              </a>
            </p>

            <label>
              <FormCheckbox {...form} name="lunch" value="saturday" /> Saturday
              Lunch
            </label>
            <label>
              <FormCheckbox {...form} name="lunch" value="sunday" /> Sunday
              Lunch
            </label>
          </div> */}
          {/* <h4 className={styles.title}>
            Wanna have our organic BFF t-shirt? (€25)
          </h4>
          <FormRadioGroup
            className={styles.radioGroup}
            {...form}
            name="shirtinfo"
          >
            <label>
              <FormRadio {...form} name="shirtinfo" value="yes" /> <p>Yes</p>
            </label>
            <label>
              <FormRadio {...form} name="shirtinfo" value="no" />
              <p>No</p>
            </label>
          </FormRadioGroup>
          {form.values.shirtinfo === "yes" && (
            <>
              <h4 className={styles.title}>Choose the T-Shirt size:</h4>
              <div className={styles.selectWrapper}>
                <select
                  onChange={(e) => form.update("tshirt", e.target.value)}
                  className={styles.select}
                >
                  {shirtSize?.map((size) => (
                    <option value={size} key={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )} */}
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

          <FormMessage className={styles.errorMessage} {...form} name="shirt" />
          {form.values.donation === "yes" && (
            <div className={styles.radioGroup}>
              <h4 className={styles.title}>How much do you want to donate?</h4>
              <FormInput
                className={styles.input}
                {...form}
                name="donation_amount"
                type="number"
                onWheel={(e) => e.target.blur()}
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
