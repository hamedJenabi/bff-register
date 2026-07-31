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
  getPrice,
  isAfterTargetDate,
  isGroupDiscount,
  partyPrice,
  titleCase,
} from "../../utils/functions";
import { emailRegex } from "../../utils/validate";
import styles from "./RegistrationForm.module.scss";
import countries from "../../utils/countries";
import React, { useEffect, useRef, useState } from "react";

const DRAFT_STORAGE_KEY = "bff_registration_draft";

const ticketLabels = {
  fullpass: "Full Pass",
  partyPass: "Party Pass",
  parentPass: "Parent Pass",
};

const defaultValues = {
  status: "registered",
  firstname: "",
  lastname: "",
  email: "",
  country: "",
  ticket: "",
  parent_partner: "",
  level: "",
  role: "",
  theme_class: "no",
  competition: "",
  open_mixnmatch_role: "",
  newcomers_mixnmatch_role: "",
  strictly_role: "",
  tshirtInfo: "",
  shirtinfo: "",
  tshirt: "",
  competitions: "",
  donation: "",
  donation_amount: "",
  lunch: "",
  voucher: "",
  terms: false,
};

const toList = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
};

const hasValidEmail = (email) =>
  Boolean(email && emailRegex.test(email.trim().toLowerCase()));

const draftContentKeys = [
  "firstname",
  "lastname",
  "email",
  "country",
  "ticket",
  "parent_partner",
  "level",
  "competition",
  "competitions",
  "open_mixnmatch_role",
  "newcomers_mixnmatch_role",
  "strictly_role",
  "shirtinfo",
  "tshirt",
  "donation",
  "donation_amount",
  "lunch",
  "voucher",
  "terms",
];

const hasDraftContent = (draft) =>
  draftContentKeys.some((key) => {
    const value = draft[key];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return Boolean(value);
  });

export default function RegistrationForm({
  form,
  tickets,
  users,
  isClicked,
  intern = false,
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftLoadedRef = useRef(false);

  const values = form.values;
  const selectedCompetitions = toList(values.competitions);
  const roleNeededComps = [
    "strictly",
    "newcomers_mixnmatch",
    "open_mixnmatch",
  ].filter((comp) => selectedCompetitions.includes(comp));

  const isPartyPass = isAfterTargetDate("2026-09-01T12:00:00+02:00");
  const isPartypassSoldout =
    users.filter((user) => user.ticket === "partyPass").length >= 92;
  const isFullPass =
    values.ticket === "fullpass" || values.ticket === "parentPass";
  const canChooseFullPass = intern;
  const canChooseParentPass = intern;
  const canChoosePartyPass = intern || (isPartyPass && !isPartypassSoldout);
  const isSoloBattleSoldOut =
    users.filter((user) => user.competitions.includes("solo_battle")).length >=
    45;

  const selectedTrack = tickets.find((ticket) => ticket.name === values.level);
  const selectedCompetitionLabels = selectedCompetitions.map((competition) => {
    const match = compettionsInfo.find(({ value }) => value === competition);
    return match?.label || titleCase(competition);
  });
  const totalPrice = values.ticket
    ? getPrice(values, isGroupDiscount(values.email), values.voucher)
    : 0;

  const personalComplete =
    Boolean(values.firstname?.trim()) &&
    Boolean(values.lastname?.trim()) &&
    hasValidEmail(values.email);
  const passComplete = Boolean(values.ticket);
  const trackComplete = !isFullPass || Boolean(values.level);
  const addOnsComplete =
    (values.competition !== "yes" ||
      roleNeededComps.every((comp) => Boolean(values[`${comp}_role`]))) &&
    Boolean(values.terms);
  const canCheckout =
    personalComplete && passComplete && trackComplete && addOnsComplete;

  useEffect(() => {
    if (typeof window === "undefined" || draftLoadedRef.current) {
      return;
    }

    draftLoadedRef.current = true;

    const storedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft);
        if (hasDraftContent(draft)) {
          const restoreKeys = new Set(Object.keys(defaultValues));
          Object.entries(draft).forEach(([key, value]) => {
            if (restoreKeys.has(key)) {
              form.update(key, value);
            }
          });
        } else {
          window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch (error) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }

    setDraftLoaded(true);
  }, [form]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.bffTheme = "dark";
    }

    return () => {
      if (typeof document !== "undefined") {
        delete document.body.dataset.bffTheme;
      }
    };
  }, []);

  useEffect(() => {
    if (!draftLoaded || typeof window === "undefined") {
      return;
    }

    if (hasDraftContent(values)) {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
    } else {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [draftLoaded, values]);
  console.log("values", values);
  const selectTicket = (ticket) => {
    // if (ticket === "fullpass") {

    // }

    // if (ticket === "parentPass") {
    //   return;
    // }

    // if (ticket === "partyPass" && !canChoosePartyPass) {
    //   return;
    // }

    form.update("ticket", ticket);

    if (ticket === "partyPass") {
      form.update("role", "");
      form.update("level", "");
    }
  };

  const ticketsWithFollow = tickets.map((ticket) => {
    if (ticket.name.includes("follow")) {
      return { ...ticket, devide: true };
    }
    return ticket;
  });

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

  const summaryRows = [
    {
      label: "Pass",
      value: ticketLabels[values.ticket] || "Not selected",
    },
    {
      label: "Role",
      value: isFullPass
        ? selectedTrack?.label || "Not selected"
        : "No class track",
    },
    // {
    //   label: "Competitions",
    //   value:
    //     selectedCompetitionLabels.length > 0
    //       ? selectedCompetitionLabels.join(", ")
    //       : values.competition === "no"
    //         ? "No competitions"
    //         : "Optional",
    // },
    {
      label: "T-shirt",
      value:
        values.shirtinfo === "yes"
          ? values.tshirt || "Choose a size"
          : values.shirtinfo === "no"
            ? "No T-shirt"
            : "Optional",
    },
    {
      label: "Donation",
      value:
        values.donation === "yes" && values.donation_amount
          ? `€${values.donation_amount}`
          : "No donation",
    },
  ];

  const renderPersonalSection = () => (
    <section
      className={styles.sectionPanel}
      aria-labelledby="personal-section-title"
    >
      <div className={styles.panelHeader}>
        <h2 id="personal-section-title" className={styles.title}>
          Your Personal Data:
        </h2>
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <FormInput
            required
            {...form}
            label="First Name"
            className={styles.input}
            name="firstname"
            placeholder="first name"
          />
          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="firstname"
          />
        </div>

        <div className={styles.field}>
          <FormInput
            {...form}
            required
            label="Last Name"
            className={styles.input}
            name="lastname"
            placeholder="last name"
          />
          <FormMessage
            className={styles.errorMessage}
            {...form}
            name="lastname"
          />
        </div>

        <div className={styles.field}>
          <FormInput
            {...form}
            required
            label="E-mail"
            className={styles.input}
            name="email"
            placeholder="email"
          />
          <FormMessage className={styles.errorMessage} {...form} name="email" />
        </div>

        <div className={styles.field}>
          <select
            id="country"
            value={values.country || ""}
            onChange={(event) => form.update("country", event.target.value)}
            className={classNames(styles.select, styles.countrySelect)}
            aria-label="country"
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
        </div>
      </div>
    </section>
  );

  const renderPassSection = () => (
    <section
      className={styles.sectionPanel}
      aria-labelledby="pass-section-title"
    >
      <div className={styles.panelHeader}>
        <h2 id="pass-section-title" className={styles.title}>
          Choose your Ticket:
        </h2>
      </div>

      <div className={styles.cardWrapper}>
        <button
          type="button"
          onClick={() => selectTicket("fullpass")}
          // disabled={!canChooseFullPass}
          aria-pressed={values.ticket === "fullpass"}
          className={classNames(styles.card, {
            [styles.selected]: values.ticket === "fullpass",
            // [styles.notAvailable]: !canChooseFullPass,
          })}
        >
          <h3>Full pass </h3>
          <p> Pick any class (6:15h)</p>

          <p>All 5 Parties</p>
          <strong className={styles.price}>€{fullpassPrice}</strong>
        </button>

        <button
          type="button"
          onClick={() => selectTicket("partyPass")}
          disabled={!canChoosePartyPass}
          aria-pressed={values.ticket === "partyPass"}
          className={classNames(styles.card, {
            [styles.selected]: values.ticket === "partyPass",
            [styles.notAvailable]: !canChoosePartyPass,
          })}
        >
          <h3>Party Pass</h3>
          <p>All 5 Parties</p>
          {!isPartyPass && (
            <span className={styles.infoText}>
              Partypass spots are available after September 1st and subject to
              availability.
            </span>
          )}
          <strong className={styles.price}>€{partyPrice}</strong>
          {isPartypassSoldout && <p>(Sold out)</p>}
        </button>

        <button
          type="button"
          onClick={() => selectTicket("parentPass")}
          // disabled={!canChooseParentPass}
          aria-pressed={values.ticket === "parentPass"}
          className={classNames(styles.card, {
            [styles.selected]: values.ticket === "parentPass",
            // [styles.notAvailable]: !canChooseParentPass,
          })}
        >
          <h3>Parent Pass </h3>
          <p>Two dancers sharing childcare</p>
          <p> Pick any class (6:15h)</p>
          <p>All 5 Parties</p>
          <strong className={styles.price}>€{partyPrice}</strong>
        </button>
      </div>

      {values.ticket === "parentPass" && (
        <div className={styles.radioGroup}>
          <h3 className={styles.title}>
            Who is your parent partner? (full name)
          </h3>
          <p className={styles.infoText}>
            Parents can team up with each other. Each person must register
            separately (1 pass per person)
          </p>
          <FormInput className={styles.input} {...form} name="parent_partner" />
        </div>
      )}
    </section>
  );

  const renderTrackSection = () => (
    <section
      className={styles.sectionPanel}
      aria-labelledby="track-section-title"
    >
      <div className={styles.panelHeader}>
        <h2 id="track-section-title" className={styles.title}>
          Choose your Role: (Classes are on Fri/Sat/Sun)
        </h2>
      </div>

      {/* <details className={styles.detailPanel}>
        <summary>*** Important note: ***</summary>
        <p>
          For the Full pass you have two options: <br /> 1. The classic "level
          classes" - if you sign up for Advanced level there will be an audition
          on Friday at 12.30 pm <br />
          OR <br />
          2. If you are at least level Intermediate, then you can choose instead
          of the classic system one of our Focus tracks. You can find level
          description and schedule{" "}
          <a
            target="_blank"
            rel="noreferrer"
            href="https://www.bluesfever.eu/passes-levels/#level"
          >
            here
          </a>
          .
          <br />
        </p>
      </details> */}

      <FormRadioGroup
        className={classNames(styles.radioGroup, styles.radioTicket)}
        {...form}
        name="level"
      >
        {tickets
          .sort((a, b) => a.id - b.id)
          .map(({ label, name: value, capacity, devide }) => (
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
                  disabled={capacity === 0}
                />
                <span>
                  {label}
                  {capacity === 0 && " –– Sold out"}
                </span>
              </label>
              {devide && <div className={styles.divider} />}
            </span>
          ))}
        <FormMessage className={styles.errorMessage} {...form} name="level" />
        {/* <p className={styles.infoText}>
          * There will be an audition for advanced track on Friday at 12:30 to
          determine the level of{" "}
          <strong>advanced 1, advanced 2 and advanced plus</strong>. <br />
        </p>
        <p className={styles.infoText}>
          ** Open to dancers with at least intermediate level experience.
        </p> */}
      </FormRadioGroup>
    </section>
  );

  const renderCompetitionSection = () => (
    <section
      className={styles.sectionPanel}
      aria-labelledby="competition-section-title"
    >
      <div className={styles.panelHeader}>
        <h2 id="competition-section-title" className={styles.title}>
          Info about competitions:
        </h2>
      </div>
      <p className={styles.infoText}>
        You can register for competitions end of October. we will send you an
        email about the registration by then.
      </p>
      {/* {!intern && <p className={styles.infoText}>Sold out</p>} */}
      {/* {intern && (
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
        </FormRadioGroup>
      )} */}

      {/* {values.competition === "yes" && (
        <div className={styles.radioGroup}>
          <h3 className={styles.title}>
            Choose your contests:
            <span className={styles.infoText}>
              <br></br> (€10 per competition - one free comp for Full Pass
              Holders)
            </span>
          </h3>
          {compettionsInfo.map(({ value, label }) => (
            <label key={value}>
              <FormCheckbox
                {...form}
                name="competitions"
                value={value}
                disabled={value === "solo_battle" && isSoloBattleSoldOut}
              />{" "}
              <span>
                {label}
                {value === "solo_battle" &&
                  isSoloBattleSoldOut &&
                  "(Fully booked)"}
              </span>
            </label>
          ))}
        </div>
      )} */}

      {values.competition === "yes" &&
        roleNeededComps.map((comp) => (
          <div className={styles.radioGroup} key={comp}>
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
                <FormRadio {...form} name={`${comp}_role`} value="follow" />
                <p>Follow </p>
              </label>
              <label>
                <FormRadio {...form} name={`${comp}_role`} value="lead" />
                <p>Lead</p>
              </label>
            </FormRadioGroup>
            <FormMessage
              className={styles.errorMessage}
              {...form}
              name={`${comp}_role`}
            />
          </div>
        ))}
    </section>
  );

  const renderShirtSection = () => (
    <section
      className={styles.sectionPanel}
      aria-labelledby="shirt-section-title"
    >
      <div className={styles.panelHeader}>
        <h2 id="shirt-section-title" className={styles.title}>
          Wanna have our organic BFF t-shirt? (€25)
        </h2>
      </div>
      <FormRadioGroup className={styles.radioGroup} {...form} name="shirtinfo">
        <label>
          <FormRadio {...form} name="shirtinfo" value="yes" />
          <p>Yes</p>
        </label>
        <label>
          <FormRadio {...form} name="shirtinfo" value="no" />
          <p>No</p>
        </label>
      </FormRadioGroup>
      {values.shirtinfo === "yes" && (
        <div className={styles.selectWrapper}>
          <label className={styles.fieldLabel} htmlFor="tshirt">
            Choose the T-Shirt size:
          </label>
          <select
            id="tshirt"
            value={values.tshirt || ""}
            onChange={(event) => form.update("tshirt", event.target.value)}
            className={styles.select}
          >
            {shirtSize.map((size) => (
              <option value={size} key={size || "empty-size"}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );

  const renderDonationSection = () => (
    <section
      className={styles.sectionPanel}
      aria-labelledby="donation-section-title"
    >
      <div className={styles.panelHeader}>
        <h2 id="donation-section-title" className={styles.title}>
          Do you want to donate to the Blues Fever Scholarship and discount
          Fund?
        </h2>
      </div>
      <p className={styles.infoText}>
        By donating you will help us to make Blues Fever more accessible to
        everyone. You can donate any amount you want.
      </p>
      <FormRadioGroup className={styles.radioGroup} {...form} name="donation">
        <label>
          <FormRadio {...form} name="donation" value="yes" />
          <p>Yes</p>
        </label>
        <label>
          <FormRadio {...form} name="donation" value="no" />
          <p>No</p>
        </label>
      </FormRadioGroup>

      {values.donation === "yes" && (
        <div className={styles.field}>
          <h3 className={styles.title}>How much do you want to donate?</h3>
          <FormInput
            className={styles.input}
            {...form}
            name="donation_amount"
            type="number"
            onWheel={(event) => event.target.blur()}
            placeholder="€"
          />
        </div>
      )}
    </section>
  );

  const renderVoucherSection = () => (
    <section
      className={styles.sectionPanel}
      aria-labelledby="voucher-section-title"
    >
      <div className={styles.panelHeader}>
        <h2 id="voucher-section-title" className={styles.title}>
          Do you have a voucher?
        </h2>
        <p className={styles.infoText}>
          Info for pass winners: If you have won a pass and have not yet
          received an email from us by July 31, please write to us at
          registration@bluesfever.eu and wait for our reply with instructions on
          how to register for your free pass.
        </p>
      </div>
      <FormInput className={styles.input} {...form} name="voucher" />
      {values.voucher === "bffdiscount2026" && (
        <p className={styles.infoText}>Your voucher has been expired!</p>
      )}

      <div className={styles.checkboxWrapper}>
        <FormCheckbox {...form} name="terms" />
        <FormLabel className={styles.infoText} {...form} name="terms">
          By accepting this, you agree to our{" "}
          <a
            rel="noreferrer"
            href="https://www.bluesfever.eu/terms-conditions/"
            target="_blank"
          >
            Terms and Conditions
          </a>{" "}
          and{" "}
          <a
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
        disabled={isClicked || !canCheckout}
        className={classNames(styles.button, {
          [styles.disabled]: isClicked || !canCheckout,
        })}
        {...form}
      >
        Register
      </FormSubmitButton>
    </section>
  );

  if (isClicked) {
    return <SkeletonComponent />;
  }

  return (
    <div className={styles.registrationExperience} data-theme="dark">
      <div className={styles.checkoutShell}>
        <header className={styles.eventHeader}>
          <img
            className={styles.eventArt}
            src="/title.png"
            alt=""
            aria-hidden="true"
          />
          <div className={styles.eventContent}>
            <h1 className={styles.eventTitle}>BLUES FEVER 2026</h1>
          </div>
          <div className={styles.headerActions}>
            <a href="https://bluesfever.eu/" target="_blank" rel="noreferrer">
              Home
            </a>
          </div>
        </header>

        <Form className={styles.container} {...form}>
          <div className={styles.checkoutGrid}>
            <div className={styles.primaryPanel}>
              {renderPersonalSection()}
              {renderPassSection()}
              {isFullPass && renderTrackSection()}
              {renderCompetitionSection()}
              {renderShirtSection()}
              {renderDonationSection()}
              {renderVoucherSection()}
            </div>

            <aside
              className={classNames(styles.summaryPanel, {
                [styles.summaryOpen]: summaryOpen,
              })}
              aria-label="Order summary"
            >
              <button
                type="button"
                className={styles.summaryToggle}
                onClick={() => setSummaryOpen((open) => !open)}
                aria-expanded={summaryOpen}
              >
                <span>
                  <span className={styles.summaryHeader}>Order summary</span>
                  <strong className={styles.summaryTotal}>€{totalPrice}</strong>
                </span>
                <span className={styles.summaryToggleText} aria-hidden="true">
                  {summaryOpen ? "Close" : "Open"}
                </span>
              </button>
              <div className={styles.summaryBody}>
                {summaryRows.map(({ label, value }) => (
                  <div className={styles.summaryRow} key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </Form>
      </div>
    </div>
  );
}
