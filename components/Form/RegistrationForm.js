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
import {
  compettionsInfo,
  fullpassPrice,
  partyPrice,
  titleCase,
  isAfterTargetDate,
} from "../../utils/functions";
import styles from "./RegistrationForm.module.scss";
import countries from "../../utils/countries";
import React, { useState, useEffect } from "react";

export default function RegistrationForm({ form, tickets, isClicked }) {
  const [ticketName, setTicketName] = useState("");
  const isPartyPass = isAfterTargetDate("2025-08-16T00:12:00+02:00");

  const handleTicket = (ticket) => {
    if (ticket === 1) {
      form.update("ticket", "fullpass");
    } else if (ticket === 3) {
      form.update("ticket", "parentPass");
    } else {
      if (isPartyPass) {
        form.update("ticket", "partyPass");
        form.update("role", "");
        form.update("level", "");
      }
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

  useEffect(() => {
    setTicketName(`${form.values.level}`);
    if (form.values.ticket === "partyPass") {
      setTicketName("partyPass");
    }
  }, [form]);
  // add a deviding line in array to show after every item in tickts array that has "follow" in its name
  const ticketsWithFollow = tickets.map((ticket) => {
    if (ticket.name.includes("follow")) {
      return { ...ticket, devide: true };
    }
    return ticket;
  });

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
              <p> 4x1.5h classes (6h)</p>
              <p>1 free competition</p>
              <p>All 5 Parties</p>
              <p>€{fullpassPrice}</p>
            </div>

            {/* {isPartyPass && ( */}
            <div
              onClick={() => handleTicket(2)}
              className={classNames(styles.card, {
                [styles.selected]: form.values.ticket === "partyPass",
                [styles.notAvailable]: !isPartyPass,
              })}
            >
              <h3>Party Pass</h3>
              <p>All 5 Parties</p>
              <p style={{ textAlign: "center" }} className={styles.infoText}>
                Partypass spots are available after August 16th and subject to
                availability.
              </p>
              <p>€{partyPrice}</p>
            </div>
            {/* )} */}
            <div
              onClick={() => handleTicket(3)}
              className={classNames(styles.card, {
                [styles.selected]: form.values.ticket === "parentPass",
              })}
            >
              <h3>Parent Pass </h3>
              <p className={styles.infoText}>Two dancers sharing childcare</p>
              <p> 4x1.5h classes (6h)</p>
              <p>All 5 Parties</p>
              <p>€{partyPrice}</p>
            </div>
          </div>
          {form.values.ticket === "parentPass" && (
            <div className={styles.radioGroup}>
              <h4 className={styles.title}>
                Who is your parent partner? (full name)
              </h4>
              <p className={styles.infoText}>
                Parents can team up with each other. Each person must register
                separately (1 pass per person)
              </p>
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
                Choose your Track: (Classes are on Fri/Sat/Sun)
              </h3>
              <div className={styles.infoTextWrapper}>
                <div className={styles.infoText}>
                  *** Important note: ***
                  <br />
                  For the Full pass you have two options: <br /> 1. The classic
                  "level classes" - if you sign up for Advanced level there will
                  be an audition on Friday at 12.30 pm <br />
                  OR <br />
                  2. If you are at least level Intermediate, then you can choose
                  instead of the classic system one of our Focus tracks. You can
                  find level description and schedule{" "}
                  <a
                    style={{ color: "blue" }}
                    target="_blank"
                    href="https://www.bluesfever.eu/passes-levels/#level"
                  >
                    here
                  </a>
                  .
                  <br />
                </div>
              </div>

              <FormRadioGroup
                className={classNames(styles.radioGroup, styles.radioTicket)}
                {...form}
                name="level"
              >
                {ticketsWithFollow
                  .sort((a, b) => a.id - b.id)
                  .map(({ label, name: value, capacity, devide }) => {
                    return (
                      <span key={value}>
                        <label
                          className={classNames({
                            [styles.disabledLabel]: capacity === 0,
                          })}
                        >
                          <FormRadio
                            {...form}
                            name="level"
                            value={value}
                            disabled={capacity === 0 || isDisabled(value)}
                          />
                          <p style={{ fontSize: "14px" }}>
                            {label}
                            {capacity === 0 && " –– Sold out"}
                          </p>
                          {/* <InfoModal header={label} info={detail} /> */}
                        </label>
                        {devide && <div className={styles.divider} />}
                      </span>
                    );
                  })}
                <FormMessage
                  className={styles.errorMessage}
                  {...form}
                  name="level"
                  style={{ fontSize: "32px", margin: "10px 0" }}
                />
                <p className={styles.infoText}>
                  * There will be an audition for advanced track on Friday at
                  12:30 to determine the level of{" "}
                  <strong>advanced 1, advanced 2 and advanced plus</strong>.{" "}
                  <br />
                </p>
                <p className={styles.infoText}>
                  ** Open to dancers with at least intermediate level
                  experience.
                </p>
              </FormRadioGroup>
            </>
          )}
          {/* {isFullPass &&
            form.values.level !== "" &&
            form.values.level !== "solo" && (
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
                  <label>
                    <FormRadio {...form} name="role" value="both" />
                    <p> Both</p>
                  </label>
                  <div className={styles.infoTextWrapper}>
                    <p className={styles.infoText}>
                      You choose <strong>"Both"</strong> role if you will attend
                      some classes as LEAD and some as FOLLOW to help balance
                      out the ratio between the two roles.
                    </p>
                  </div>
                </FormRadioGroup>
              </>
            )} */}

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
                value="build_a_choreography"
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
                        disabled={comp === "newcomers_mixnmatch"}
                      />
                      <p>
                        Follow{" "}
                        {comp === "newcomers_mixnmatch" && (
                          <span>(Fully booked)</span>
                        )}
                      </p>
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
          <h4 className={styles.title}>
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
          )}
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
          <div className={styles.radioGroup}>
            <h4 className={styles.title}>Do you have a voucher?</h4>
            <FormInput className={styles.input} {...form} name="voucher" />
            {form.values.voucher === "bffdiscount2025" && (
              <p className={styles.infoText}>Your voucher has been expired!</p>
            )}
          </div>
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
