import { useEffect, useState } from "react";
import { Dialog, DialogBackdrop, DialogDisclosure, useDialogState } from "reakit/Dialog";
import dialogStyles from "./RegisteredClasses.module.scss";
import styles from "./RegistrationLink.module.scss";

export default function RegistrationLink({ id, firstname, lastname, buttonClassName, kind = "registration" }) {
  const appLink = kind === "app";
  const title = appLink ? "Personal app link" : "Registration link";
  const buttonLabel = appLink ? "Generate app link" : "Generate link";
  const prefix = appLink ? "app-link" : "registration-link";
  const dialog = useDialogState({ baseId: `${prefix}-${id}`, animated: true });
  const [hasOpened, setHasOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { setAnimated, stopAnimation } = dialog;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setAnimated(!preference.matches); stopAnimation(); };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [setAnimated, stopAnimation]);
  const name = [firstname, lastname].filter(Boolean).join(" ") || `Participant ${id}`;
  const titleId = `${prefix}-title-${id}`;
  const summaryId = `${prefix}-summary-${id}`;
  const inputId = `${prefix}-url-${id}`;
  const generate = async () => {
    setHasOpened(true); setLoading(true); setUrl(""); setMessage(""); setError("");
    try {
      const response = await fetch(appLink ? "/api/app/admin/link" : "/api/reg2026/link", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Could not generate the ${appLink ? "app" : "registration"} link.`);
      const generated = appLink ? result.appAccessUrl : result.registrationUrl;
      if (typeof generated !== "string" || !generated) throw new Error("The link could not be generated. Please try again.");
      setUrl(generated);
    } catch (failure) { setError(failure.message || "Could not generate the link."); }
    finally { setLoading(false); }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch { setMessage("Select and copy the link above."); }
  };
  return <>
    <DialogDisclosure {...dialog} className={buttonClassName} onClick={generate} disabled={loading}
      aria-label={`${buttonLabel} for ${name} (ID ${id})`}>{buttonLabel}</DialogDisclosure>
    {hasOpened && <DialogBackdrop {...dialog} className={dialogStyles.backdrop} data-animated={String(dialog.animated)}>
      <Dialog {...dialog} className={dialogStyles.dialog} data-animated={String(dialog.animated)}
        aria-labelledby={titleId} aria-describedby={summaryId} aria-busy={loading}>
        <header className={dialogStyles.header}>
          <div><h2 id={titleId}>{title}</h2><p>{name} · ID {id}</p></div>
          <button type="button" className={dialogStyles.close} onClick={dialog.hide} aria-label={`Close ${appLink ? "app" : "registration"} link`}>×</button>
        </header>
        <p id={summaryId} className={dialogStyles.summary}>{appLink
          ? "Share this personal link to open their schedule, profile and festival QR. Generating it does not send an email."
          : "Share this link with the participant to register their festival choices."}</p>
        {loading && <p role="status" className={dialogStyles.message}>Generating link…</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {url && <>
          <label htmlFor={inputId} className={styles.label}>{appLink ? "App URL" : "Registration URL"}</label>
          <input id={inputId} type="text" readOnly value={url} className={styles.input}
            onFocus={(event) => event.currentTarget.select()} />
          <div className={dialogStyles.actions}>
            <button type="button" className={dialogStyles.action} onClick={copy}>{appLink ? "Copy app link" : "Copy link"}</button>
            <a className={dialogStyles.secondary} href={url} target="_blank" rel="noreferrer">{appLink ? "Open app" : "Open registration"}</a>
          </div>
        </>}
        {message && <p role="status" className={dialogStyles.message}>{message}</p>}
      </Dialog>
    </DialogBackdrop>}
  </>;
}
