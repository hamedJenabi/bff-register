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
import { requiredClassesError, validateDraft } from "../lib/reg2026/validation";
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
  const { user, sig } = access;
  const [data, setData] = useState(initial);
  const [requestKey, setRequestKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [networkBusy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const pending = ["provisional", "payment_pending"].includes(
    data?.order?.status,
  );
  const editingChoices = editing && !!data?.edit && !pending;
  const completed = !!data?.completed && !pending && !editingChoices;

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
        data.schedule,
        editingChoices,
      );
      if (Object.keys(errors).length) throw errors;
    },
    onSubmit: async (values) => {
      const validated = validateDraft(
        registrationDraft(values),
        data.participant,
        data.schedule,
        editingChoices ? data.choices : undefined,
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
            ...(editingChoices ? { editVersion: data.edit.version } : {}),
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          if ([409, 422].includes(response.status)) await refresh(undefined, true).catch(() => {});
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
          completed: current.completed || result.order.status === "confirmed",
          edit: null,
        }));
        setEditing(false);
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
  const missingClasses = requiredClassesError(data?.participant.ticket, draft.classes.length);
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
    setData(initial);
    setEditing(false);
    if (!initial) return;
    Object.entries(
      registrationFormValues(initial.pendingDraft || initial.choices),
    ).forEach(([name, value]) => update(name, value));
    setRequestKey(newKey());
    setHydrated(true);
  }, [initial, update]);

  const refresh = async (orderId = data?.order?.id, preserveDraft = false) => {
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
    const sameEdit = preserveDraft && editingChoices && result.edit?.version === data.edit.version;
    if (result.completed && !result.pendingDraft && !sameEdit) {
      restoreForm(result.choices);
      setRequestKey(newKey());
      if (!preserveDraft || !result.edit) setEditing(false);
      if (!preserveDraft) {
        setMessage(pending && data.completed && result.order?.id !== orderId
          ? "Your previously confirmed choices are unchanged."
          : "");
      }
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
  const editClosesAt = data?.edit?.closesAt;
  useEffect(() => {
    if (!editClosesAt) return;
    let timer;
    const checkDeadline = () => {
      const remaining = editClosesAt - Date.now();
      if (remaining <= 0) {
        setData((current) => current?.edit?.closesAt === editClosesAt ? { ...current, edit: null, open: false } : current);
      } else {
        timer = setTimeout(checkDeadline, Math.min(remaining, 2147483647));
      }
    };
    checkDeadline();
    return () => clearTimeout(timer);
  }, [editClosesAt]);
  useEffect(() => {
    if (!hydrated || completed || pending) return;
    const controller = new AbortController();
    let active = true;
    let refreshing = false;
    const refreshAvailability = async () => {
      if (document.visibilityState === "hidden" || refreshing) return;
      refreshing = true;
      try {
        const query = new URLSearchParams({ user, sig });
        const response = await fetch(`/api/reg2026?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        if (active) setData((current) => current ? {
          ...current,
          availability: result.availability,
          open: result.open,
          // Keep the draft's original version so a stale tab can't overwrite newer choices.
          edit: result.edit ? current.edit : null,
        } : current);
      } catch {
        // Retain the last known availability during temporary network failures.
        // Submission still checks capacity under the booking lock.
      } finally {
        refreshing = false;
      }
    };
    refreshAvailability();
    const timer = setInterval(refreshAvailability, 10000);
    window.addEventListener("focus", refreshAvailability);
    document.addEventListener("visibilitychange", refreshAvailability);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refreshAvailability);
      document.removeEventListener("visibilitychange", refreshAvailability);
    };
  }, [hydrated, completed, pending, user, sig]);
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
      ? priceDraft(draft, data.choices, editingChoices)
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
            {!data.open && !completed && !data.completed && (
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
                        : editingChoices
                          ? "Edit your festival choices through November 20 (Vienna time)."
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
                <h2 id="complete-title">Registration confirmed</h2>
                <p>Thank you! Your festival choices have been saved.</p>
                {data.edit && (
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} disabled={!hydrated || busy} onClick={() => {
                      restoreForm(data.choices);
                      setRequestKey(newKey());
                      setMessage("");
                      setEditing(true);
                    }}>Edit festival choices</button>
                  </div>
                )}
                {message && <p role="status">{message}</p>}
                <p>
                  {data.edit ? "For help, contact" : "For any changes, contact"}{" "}
                  the organizers at{" "}
                  <a href="mailto:registration@bluesfever.eu">registration@bluesfever.eu</a>.
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
                    <p>{data.participant.ticket === "fullpass" ? "Required:" : "Maximum"} {CLASS_SELECTION_LIMIT} across all days</p>
                  </aside>
                )}
                <Form {...form} aria-busy={busy}>
                  {data.participant.ticket !== "partyPass" && (
                    <Schedule
                      participant={data.participant}
                      form={editForm}
                      availability={data.availability.classes}
                      sessions={data.schedule}
                      savedClasses={editingChoices ? data.choices.classes : undefined}
                      disabled={busy || pending || !data.open}
                    />
                  )}
                  <CompetitionSection
                    form={editForm}
                    saved={data.choices}
                    availability={data.availability.competitions}
                    sessions={data.schedule}
                    disabled={busy || pending || !data.open}
                    editing={editingChoices}
                  />
                  {!editingChoices && <LunchSection
                    form={editForm}
                    saved={data.choices}
                    disabled={busy || pending || !data.open}
                  />}
                  <section
                    className={styles.review}
                    aria-labelledby="review-title"
                  >
                    <h2 id="review-title">Review and submit</h2>
                    <p>
                      {data.participant.ticket !== "partyPass" &&
                        "Class registration is included in your pass. "}
                      {editingChoices
                        ? "You only pay for new competition entries. Lunch bookings stay as confirmed."
                        : "Competition entries and lunch are paid together. Existing purchases are credited."}
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
                    <p>Review all choices before submitting.</p>
                    <div className={styles.voucher}>
                      <FormLabel {...editForm} name="voucher">Voucher</FormLabel>
                      <FormInput {...editForm} name="voucher" type="text" className={styles.voucherInput}
                        placeholder="Enter your voucher code" autoComplete="off" spellCheck={false}
                        disabled={busy || !data.open} />
                      <FormMessage {...form} name="voucher" />
                      {draft.voucher === FREE_PASS_VOUCHER && <p role="status" aria-live="polite">Voucher applied. All selected options are free.</p>}
                    </div>
                    <FormMessage {...form} name="formError" />
                    {missingClasses && (
                      <p id="reg2026-required-classes" className={styles.requiredClasses}>{missingClasses}</p>
                    )}
                    <FormSubmitButton
                      {...form}
                      className={styles.primary}
                      aria-describedby={missingClasses ? "reg2026-required-classes" : undefined}
                      disabled={busy || pending || !data.open || !hydrated || !!missingClasses}
                    >
                      {redirecting
                        ? "Opening secure checkout…"
                        : busy
                          ? "Saving…"
                          : price.totalCents > 0
                            ? `Continue to payment · ${euros(price.totalCents)}`
                            : editingChoices ? "Save changes" : "Save festival choices"}
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
    const { resolveParticipant, publicParticipant, isRegistrationOpen } =
      await import("../lib/reg2026/access");
    const { choicesFromParticipant } =
      await import("../lib/reg2026/serialization");
    const { publicOrder } = await import("../lib/reg2026/http");
    const { loadRegistrationState } = await import("../lib/reg2026/state");
    const participant = await resolveParticipant(access, store);
    const { order, completed, edit } = await loadRegistrationState(store, participant, query.order);
    const initial = {
      participant: publicParticipant(participant),
      choices: choicesFromParticipant(participant),
      availability: await store.availability(participant.id),
      schedule: await store.schedule(),
      open: completed ? !!edit : isRegistrationOpen(),
      completed,
      edit,
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
