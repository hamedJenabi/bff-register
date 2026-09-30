import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Schedule from "../components/Reg2026/Schedule";
import { CompetitionSection, LunchSection } from "../components/Reg2026/AddOnSections";
import { CATALOG_VERSION } from "../lib/reg2026/catalog";
import { priceDraft } from "../lib/reg2026/pricing";
import { validateDraft } from "../lib/reg2026/validation";
import styles from "../components/Reg2026/Registration.module.scss";

const euros = (cents) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR" }).format(cents / 100);
const newKey = () => window.crypto.randomUUID();
const passLabel = { fullpass: "Full Pass", parentPass: "Parent Pass", partyPass: "Party Pass" };

export default function Registration({ initial, access, loadError }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState(initial?.pendingDraft || initial?.choices);
  const [requestKey, setRequestKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [wantsCompetition, setWantsCompetition] = useState(!!draft?.competitions.length);
  const [draftNotice, setDraftNotice] = useState("");
  const storageKey = initial ? `bff-reg2026-${initial.participant.id}-${CATALOG_VERSION}` : "";
  const pending = ["provisional", "payment_pending"].includes(data?.order?.status);

  useEffect(() => {
    document.body.dataset.bffTheme = "dark";
    return () => { delete document.body.dataset.bffTheme; };
  }, []);
  useEffect(() => {
    if (!initial) return;
    let restored = initial.pendingDraft || initial.choices;
    let key = newKey();
    try {
      const record = JSON.parse(localStorage.getItem(storageKey));
      if (!initial.pendingDraft && record?.savedVersion === JSON.stringify(initial.choices) &&
          ["classes", "competitions", "lunch"].every((field) => Array.isArray(record.draft?.[field]))) {
        // Incomplete competition roles are still useful drafts; normalize unsafe choices.
        restored = validateDraft(record.draft, initial.participant).value;
        key = ["expired", "payment_failed"].includes(initial.order?.status) ? key : record.requestKey || key; setDraftNotice("Your local draft has been restored.");
      }
    } catch { setDraftNotice("Local draft saving is unavailable in this browser."); }
    setDraft(restored); setWantsCompetition(restored.competitions.length > 0); setRequestKey(key); setHydrated(true);
  }, [initial, storageKey]);
  useEffect(() => {
    if (!hydrated || !draft || pending) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ draft, requestKey, savedVersion: JSON.stringify(data.choices) })); }
    catch { setDraftNotice("Local draft saving is unavailable in this browser."); }
  }, [draft, requestKey, data, storageKey, hydrated, pending]);

  const refresh = async (orderId = data?.order?.id) => {
    const query = new URLSearchParams({ ...access, ...(orderId ? { order: orderId } : {}) });
    const response = await fetch(`/api/reg2026?${query}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
    if (!["provisional", "payment_pending"].includes(result.order?.status)) setCheckoutUrl(null);
    if (["expired", "payment_failed"].includes(result.order?.status)) setRequestKey(newKey());
    if (result.order?.status === "confirmed") {
      setDraft(result.choices); setWantsCompetition(result.choices.competitions.length > 0);
      setMessage("Your festival choices are confirmed.");
      try { localStorage.removeItem(storageKey); } catch {}
    }
    return result;
  };
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => { refresh().catch((error) => setMessage(error.message)); }, 10000);
    return () => clearInterval(timer);
    // Poll only while the participant is waiting for a verified payment status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, data?.order?.id]);
  const change = (next) => { setDraft(next); setRequestKey(newKey()); setErrors({}); setMessage("You have unsaved changes. Submit to save them."); };
  const submit = async (event) => {
    event.preventDefault();
    const validated = validateDraft(draft, data.participant);
    const price = priceDraft(validated.value, data.choices);
    if (!validated.valid || Object.keys(price.errors).length) {
      setErrors({ ...validated.errors, ...price.errors }); setMessage("Please check your choices."); return;
    }
    setBusy(true); setErrors({}); setMessage("");
    try {
      const response = await fetch("/api/reg2026/submit", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...access, draft: validated.value, requestKey }) });
      const result = await response.json();
      if (!response.ok) { setErrors(result.errors || {}); throw new Error(result.error); }
      setData((current) => ({ ...current, order: result.order, pendingDraft: draft }));
      if (result.checkoutUrl) {
        setCheckoutUrl(result.checkoutUrl);
        setMessage("Your places are provisionally held. Review the validated total below, then open secure checkout.");
        return;
      }
      await refresh(result.order.id);
      // Keep the verified order in the URL so refreshes display the confirmation.
      await router.replace({ pathname: "/reg2026", query: { ...access, order: result.order.id } }, undefined, { shallow: true });
    } catch (error) { setMessage(error.message || "Could not submit. Your draft has been kept."); }
    finally { setBusy(false); }
  };
  const checkoutAction = async (cancel) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/reg2026/${cancel ? "cancel" : "checkout"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(access),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
      else await refresh(result.order?.id || "");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const price = pending ? { subtotalCents: data.order.subtotalCents, feeCents: data.order.feeCents, totalCents: data.order.totalCents }
    : draft && data ? priceDraft(draft, data.choices) : null;
  return <div className={styles.page}>
    <Head><title>Festival choices · Blues Fever 2026</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>
    <header className={styles.header}><a href="https://www.bluesfever.eu/">Blues Fever</a><p>Vienna · 2026</p></header>
    <main className={styles.main}>
      {!data ? <section><h1>Festival choices</h1><p role="alert">{loadError || "This registration link is unavailable."}</p><p>Please contact the organizers for help.</p></section> : <>
        <div className={styles.intro}><p>Your festival registration</p><h1>{data.participant.firstname} {data.participant.lastname}</h1>
          <p>{passLabel[data.participant.ticket] || data.participant.ticket} · {data.participant.ticket === "partyPass" ? "Competitions and lunch" : "Classes, competitions and lunch"}</p></div>
        {!data.open && <p className={styles.notice}>Registration is closed. You can view your saved choices and payment status.</p>}
        {draftNotice && <p className={styles.notice}>{draftNotice}</p>}
        <div className={styles.notice} role="status" aria-live="polite">
          {message || (data.order?.status === "confirmed" ? "Your festival choices are confirmed." :
            data.order?.status === "payment_pending" ? "Payment is processing. Your previous saved choices remain in place until payment is verified." :
            data.order?.status === "provisional" ? "Checkout is open. These choices are provisional for up to one hour. Payment has not yet been confirmed." :
            ["expired", "payment_failed"].includes(data.order?.status) ? "Checkout expired or payment failed. Your previous confirmed choices are unchanged." : "Review your choices, then submit them together.")}
        </div>
        {pending && <div className={styles.actions}>
          {data.order.status === "provisional" && <><button type="button" disabled={busy} onClick={() => checkoutUrl ? window.location.assign(checkoutUrl) : checkoutAction(false)}>Open secure checkout</button>
            <button type="button" disabled={busy} onClick={() => checkoutAction(true)}>Cancel pending checkout</button></>}
          <button type="button" disabled={busy} onClick={() => refresh().catch((error) => setMessage(error.message))}>Check payment status</button>
        </div>}
        <form onSubmit={submit} aria-busy={busy}>
          {data.participant.ticket !== "partyPass" && <Schedule participant={data.participant} draft={draft} change={change}
            availability={data.availability.classes} error={errors.classes} reportError={(value) => setErrors((current) => ({ ...current, classes: value }))}
            disabled={busy || pending || !data.open} />}
          <CompetitionSection draft={draft} saved={data.choices} wantsCompetition={wantsCompetition} setWantsCompetition={setWantsCompetition}
            change={change} remaining={data.availability.soloBattleRemaining} error={errors.competitions} disabled={busy || pending || !data.open} />
          <LunchSection draft={draft} saved={data.choices} change={change} error={errors.lunch} disabled={busy || pending || !data.open} />
          <section className={styles.review} aria-labelledby="review-title"><h2 id="review-title">Review and submit</h2>
            <p>{data.participant.ticket !== "partyPass" && "Class registration is included in your pass. "}Only new lunch and competition bookings are charged.</p>
            <dl><div><dt>New add-ons</dt><dd>{euros(price.subtotalCents)}</dd></div><div><dt>Stripe fee (1.4% + €0.25)</dt><dd>{euros(price.feeCents)}</dd></div>
              <div><dt>Total due</dt><dd>{euros(price.totalCents)}</dd></div></dl>
            <p>{data.participant.ticket !== "partyPass" && "Adding classes here is a draft action. "}Availability is checked again on submission.</p>
            {errors.form && <p role="alert">{errors.form}</p>}
            <button className={styles.primary} type="submit" disabled={busy || pending || !data.open || !hydrated}>
              {busy ? "Saving…" : price.totalCents > 0 ? `Continue to payment · ${euros(price.totalCents)}` : "Save festival choices"}</button>
          </section>
        </form>
      </>}
    </main>
    <footer className={styles.footer}>Blues Fever 2026 · See you in Vienna</footer>
  </div>;
}

export async function getServerSideProps({ query, res }) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const access = { user: typeof query.user === "string" ? query.user : "", sig: typeof query.sig === "string" ? query.sig : "" };
  try {
    const { registrationStore: store } = await import("../db/reg2026");
    const { resolveParticipant, publicParticipant, assertRegistrationOpen } = await import("../lib/reg2026/access");
    const { choicesFromParticipant } = await import("../lib/reg2026/serialization");
    const { publicOrder } = await import("../lib/reg2026/http");
    const participant = await resolveParticipant(access, store);
    const order = typeof query.order === "string" && /^\d+$/.test(query.order) ? await store.order(query.order, participant.id) : await store.activeOrder(participant.id);
    let open = true;
    try { assertRegistrationOpen(); } catch { open = false; }
    const initial = { participant: publicParticipant(participant), choices: choicesFromParticipant(participant),
      availability: await store.availability(participant.id), open, order: publicOrder(order),
      pendingDraft: ["provisional", "payment_pending"].includes(order?.status) ? order.draft : null };
    return { props: { initial: JSON.parse(JSON.stringify(initial)), access, loadError: null } };
  } catch (error) {
    res.statusCode = error.status || 503;
    return { props: { initial: null, access, loadError: error.status ? error.message : "Registration is temporarily unavailable. Please try again." } };
  }
}
