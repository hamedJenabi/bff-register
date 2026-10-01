import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  unstable_useFormState as useFormState,
  unstable_Form as Form,
  unstable_FormMessage as FormMessage,
  unstable_FormInput as FormInput,
  unstable_FormLabel as FormLabel,
  unstable_FormSubmitButton as FormSubmitButton,
} from "reakit/Form";
import {
  registrationDraft,
  registrationFormValues,
  registrationFormErrors,
  validateRegistrationForm,
} from "../lib/reg2026/form";
import Schedule from "../components/Reg2026/Schedule";
import {
  CompetitionSection,
  LunchSection,
} from "../components/Reg2026/AddOnSections";
import { CLASS_SELECTION_LIMIT, FREE_PASS_VOUCHER } from "../lib/reg2026/catalog";
import { priceDraft } from "../lib/reg2026/pricing";
import { validateDraft } from "../lib/reg2026/validation";
import styles from "../components/Reg2026/Registration.module.scss";

const euros = (cents) =>
  new Intl.NumberFormat("en", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
const newKey = () => window.crypto.randomUUID();
const passLabel = {
  fullpass: "Full Pass",
  parentPass: "Parent Pass",
  partyPass: "Party Pass",
};

export default function Registration({ initial, access, loadError }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [requestKey, setRequestKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [networkBusy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = ["provisional", "payment_pending"].includes(
    data?.order?.status,
  );

  const completed =
    !pending && !!(data?.completed || data?.order?.status === "confirmed");

  const form = useFormState({
    baseId: "reg2026",
    // React Strict Mode replays effect cleanup; drafts should survive it.
    resetOnUnmount: false,
    values: registrationFormValues(initial?.pendingDraft || initial?.choices),
    onValidate: (values) => {
      if (!data) return;
      const errors = validateRegistrationForm(
        values,
        data.participant,
        data.choices,
      );
      if (Object.keys(errors).length) throw errors;
    },
    onSubmit: async (values) => {
      const validated = validateDraft(
        registrationDraft(values),
        data.participant,
      );
      setMessage("");
      try {
        const response = await fetch("/api/reg2026/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...access,
            draft: validated.value,
            requestKey,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 409) await refresh().catch(() => {});
          setMessage(
            result.error || "Could not submit. Your draft has been kept.",
          );
          throw registrationFormErrors({
            ...result.errors,
            form: result.error || "Could not submit. Your draft has been kept.",
          });
        }
        if (result.checkoutUrl) {
          setRedirecting(true);
          setMessage("Opening secure checkout…");
          window.location.assign(result.checkoutUrl);
          return;
        }
        setData((current) => ({
          ...current,
          order: result.order,
          pendingDraft: validated.value,
        }));
        await refresh(result.order.id);
        // Keep the verified order in the URL so refreshes display the confirmation.
        await router.replace(
          {
            pathname: "/reg2026",
            query: { ...access, order: result.order.id },
          },
          undefined,
          { shallow: true },
        );
      } catch (error) {
        setRedirecting(false);
        if (error.formError) throw error;
        const text =
          error.message || "Could not submit. Your draft has been kept.";
        setMessage(text);
        throw { formError: text };
      }
    },
  });
  const draft = registrationDraft(form.values);
  const busy = networkBusy || form.submitting || redirecting;
  const { update } = form;
  const restoreForm = (choices, compete) => {
    Object.entries(registrationFormValues(choices, compete)).forEach(
      ([name, value]) => update(name, value),
    );
  };
  const editForm = {
    ...form,
    update: (name, value) => {
      update(name, value);
      setRequestKey(newKey());
      setMessage("You have unsaved changes. Submit to save them.");
    },
  };

  useEffect(() => {
    document.body.dataset.bffTheme = "dark";
    return () => {
      delete document.body.dataset.bffTheme;
    };
  }, []);
  useEffect(() => {
    if (!initial) return;
    Object.entries(
      registrationFormValues(initial.pendingDraft || initial.choices),
    ).forEach(([name, value]) => update(name, value));
    setRequestKey(newKey());
    setHydrated(true);
  }, [initial, update]);

  const refresh = async (orderId = data?.order?.id) => {
    const query = new URLSearchParams({
      ...access,
      ...(orderId ? { order: orderId } : {}),
    });
    const response = await fetch(`/api/reg2026?${query}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
    if (["expired", "payment_failed"].includes(result.order?.status))
      setRequestKey(newKey());
    if (result.order?.status === "confirmed") {
      restoreForm(result.choices);
      setMessage("Your festival choices are confirmed.");
    }
    return result;
  };
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      refresh().catch((error) => setMessage(error.message));
    }, 10000);
    return () => clearInterval(timer);
    // Poll only while the participant is waiting for a verified payment status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, data?.order?.id]);
  const checkoutAction = async (cancel) => {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/reg2026/${cancel ? "cancel" : "checkout"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(access),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.checkoutUrl) {
        setRedirecting(true);
        setMessage("Opening secure checkout…");
        window.location.assign(result.checkoutUrl);
      } else await refresh(result.order?.id || "");
    } catch (error) {
      setRedirecting(false);
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  const price = pending
    ? {
        subtotalCents: data.order.subtotalCents,
        feeCents: data.order.feeCents,
        totalCents: data.order.totalCents,
      }
    : draft && data
      ? priceDraft(draft, data.choices)
      : null;
  return (
    <div className={styles.page}>
      <Head>
        <title>Festival choices · Blues Fever 2026</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <header className={styles.header}>
        <a href="https://www.bluesfever.eu/">Blues Fever</a>
        <p>Vienna · 2026</p>
      </header>
      <main className={styles.main}>
        {!data ? (
          <section>
            <h1>Festival choices</h1>
            <p role="alert">
              {loadError || "This registration link is unavailable."}
            </p>
            <p>Please contact the organizers for help.</p>
          </section>
        ) : (
          <>
            <div className={styles.intro}>
              <p>Your festival registration</p>
              <h1>
                {data.participant.firstname} {data.participant.lastname}
              </h1>
              <p>
                {passLabel[data.participant.ticket] || data.participant.ticket}{" "}
                ·{" "}
                {data.participant.ticket === "partyPass"
                  ? "Competitions and lunch"
                  : "Classes, competitions and lunch"}
              </p>
            </div>
            {!data.open && !completed && (
              <p className={styles.notice}>
                Registration is closed. You can check pending payment status.
              </p>
            )}
            {!completed && (
              <div className={styles.notice} role="status" aria-live="polite">
                {message ||
                  (data.order?.status === "payment_pending"
                    ? "Payment is processing. Registration will complete after payment is verified."
                    : data.order?.status === "provisional"
                      ? "Checkout is open. These choices are provisional for up to one hour. Payment has not yet been confirmed."
                      : ["expired", "payment_failed"].includes(data.order?.status)
                        ? "Checkout expired or payment failed. Please review your choices and try again."
                        : "Review your choices, then submit them together.")}
              </div>
            )}
            {pending && (
              <div className={styles.actions}>
                {data.order.status === "provisional" && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => checkoutAction(false)}
                    >
                      Open secure checkout
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => checkoutAction(true)}
                    >
                      Cancel pending checkout
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    refresh().catch((error) => setMessage(error.message))
                  }
                >
                  Check payment status
                </button>
              </div>
            )}
            {completed ? (
              <section aria-labelledby="complete-title">
                <h2 id="complete-title">Registration complete</h2>
                <p>Your festival choices are confirmed. Thank you!</p>
                <p>
                  For any changes, contact{" "}
                  <a href="mailto:registration@bluesfever.eu">the organizers</a>.
                </p>
                <a href="https://www.bluesfever.eu/">Back to Blues Fever</a>
              </section>
            ) : pending ? (
              <section className={styles.review} aria-labelledby="pending-title">
                <h2 id="pending-title">Complete your payment</h2>
                <p>
                  Your choices are held while you finish checkout. Payment must
                  be confirmed to complete registration.
                </p>
                <dl>
                  <div>
                    <dt>Add-ons</dt>
                    <dd>{euros(price.subtotalCents)}</dd>
                  </div>
                  <div>
                    <dt>Stripe fee (1.4% + €0.25)</dt>
                    <dd>{euros(price.feeCents)}</dd>
                  </div>
                  <div>
                    <dt>Total due</dt>
                    <dd>{euros(price.totalCents)}</dd>
                  </div>
                </dl>
              </section>
            ) : (
              <div
                className={
                  data.participant.ticket !== "partyPass"
                    ? styles.registrationLayout
                    : undefined
                }
              >
                {data.participant.ticket !== "partyPass" && (
                  <aside
                    className={styles.selectionSummary}
                    aria-label="Selected class total"
                  >
                    <span
                      className={styles.selectionCount}
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <strong>{draft.classes.length}</strong>{" "}
                      {draft.classes.length === 1 ? "class" : "classes"} selected
                    </span>
                    <p>Maximum {CLASS_SELECTION_LIMIT} across all days</p>
                  </aside>
                )}
                <Form {...form} aria-busy={busy}>
                  {data.participant.ticket !== "partyPass" && (
                    <Schedule
                      participant={data.participant}
                      form={editForm}
                      availability={data.availability.classes}
                      disabled={busy || pending || !data.open}
                    />
                  )}
                  <CompetitionSection
                    form={editForm}
                    saved={data.choices}
                    remaining={data.availability.soloBattleRemaining}
                    disabled={busy || pending || !data.open}
                  />
                  <LunchSection
                    form={editForm}
                    saved={data.choices}
                    disabled={busy || pending || !data.open}
                  />
                  <section
                    className={styles.review}
                    aria-labelledby="review-title"
                  >
                    <h2 id="review-title">Review and submit</h2>
                    <p>
                      {data.participant.ticket !== "partyPass" &&
                        "Class registration is included in your pass. "}
                      Competition entries and lunch are paid together. Existing
                      purchases are credited.
                    </p>
                    <dl>
                      <div>
                        <dt>Add-ons</dt>
                        <dd>{euros(price.subtotalCents)}</dd>
                      </div>
                      <div>
                        <dt>Stripe fee (1.4% + €0.25)</dt>
                        <dd>{euros(price.feeCents)}</dd>
                      </div>
                      <div>
                        <dt>Total due</dt>
                        <dd>{euros(price.totalCents)}</dd>
                      </div>
                    </dl>
                    <p>
                      {data.participant.ticket !== "partyPass" &&
                        "Adding classes here is a draft action. "}
                      Availability is checked again on submission.
                    </p>
                    <p>
                      This is a one-time registration. Review all choices before
                      submitting. Contact the organizers for any later changes.
                    </p>
                    <div className={styles.voucher}>
                      <FormLabel {...editForm} name="voucher">Voucher</FormLabel>
                      <FormInput {...editForm} name="voucher" type="text" className={styles.voucherInput}
                        placeholder="Enter your voucher code" autoComplete="off" spellCheck={false}
                        disabled={busy || !data.open} />
                      <FormMessage {...form} name="voucher" />
                      {draft.voucher === FREE_PASS_VOUCHER && <p role="status" aria-live="polite">Voucher applied. All selected options are free.</p>}
                    </div>
                    <FormMessage {...form} name="formError" />
                    <FormSubmitButton
                      {...form}
                      className={styles.primary}
                      disabled={busy || pending || !data.open || !hydrated}
                    >
                      {redirecting
                        ? "Opening secure checkout…"
                        : busy
                          ? "Saving…"
                          : price.totalCents > 0
                            ? `Continue to payment · ${euros(price.totalCents)}`
                            : "Save festival choices"}
                    </FormSubmitButton>
                  </section>
                </Form>
              </div>
            )}
          </>
        )}
      </main>
      <footer className={styles.footer}>
        Blues Fever 2026 · See you in Vienna
      </footer>
    </div>
  );
}

export async function getServerSideProps({ query, res }) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const access = {
    user: typeof query.user === "string" ? query.user : "",
    sig: typeof query.sig === "string" ? query.sig : "",
  };
  try {
    const { registrationStore: store } = await import("../db/reg2026");
    const { resolveParticipant, publicParticipant, assertRegistrationOpen } =
      await import("../lib/reg2026/access");
    const { choicesFromParticipant } =
      await import("../lib/reg2026/serialization");
    const { publicOrder } = await import("../lib/reg2026/http");
    const participant = await resolveParticipant(access, store);
    const order =
      typeof query.order === "string" && /^\d+$/.test(query.order)
        ? await store.order(query.order, participant.id)
        : await store.activeOrder(participant.id) || await store.completedOrder(participant.id);
    let open = true;
    try {
      assertRegistrationOpen();
    } catch {
      open = false;
    }
    const initial = {
      participant: publicParticipant(participant),
      choices: choicesFromParticipant(participant),
      availability: await store.availability(participant.id),
      open,
      completed: !!(await store.completedOrder(participant.id)),
      order: publicOrder(order),
      pendingDraft: ["provisional", "payment_pending"].includes(order?.status)
        ? order.draft
        : null,
    };
    return {
      props: {
        initial: JSON.parse(JSON.stringify(initial)),
        access,
        loadError: null,
      },
    };
  } catch (error) {
    res.statusCode = error.status || 503;
    return {
      props: {
        initial: null,
        access,
        loadError: error.status
          ? error.message
          : "Registration is temporarily unavailable. Please try again.",
      },
    };
  }
}
