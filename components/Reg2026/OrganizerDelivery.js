import { useEffect, useState } from "react";
export default function OrganizerDelivery() {
  const [summary, setSummary] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = async (action) => {
    const response = await fetch("/api/reg2026/invitations", action ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    } : undefined);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load email deliveries.");
    setSummary(result.summary);
    return result;
  };
  useEffect(() => { request().catch((error) => setMessage(error.message)); }, []);
  const run = async (action) => {
    if (!window.confirm(action === "queue" ? "Queue registration invitations for confirmed, unambiguous 2026 participants? Previously sent invitations will not be resent." :
      action === "retry" ? "Retry up to 25 failed or interrupted confirmation/invitation emails?" : "Send the next 25 queued emails?")) return;
    setBusy(true); setMessage("");
    try {
      const result = await request(action);
      setMessage(action === "queue" ? "Invitations queued. Send queued emails to deliver the next batch." : `Processed ${result.processed} delivery attempts. Check the counts below for failures.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="delivery-title" style={{ margin: "24px 0", padding: "20px", border: "1px solid #7a4552" }}>
    <h3 id="delivery-title" style={{ fontSize: "22px" }}>2026 registration invitations and confirmations</h3>
    <p>Invitations use signed participant links. The server selects confirmed recipients; ambiguous identities are omitted.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", margin: "16px 0" }}>
      <button type="button" disabled={busy} onClick={() => run("queue")}>Queue registration invitations</button>
      <button type="button" disabled={busy} onClick={() => run("send")}>Send next 25 queued emails</button>
      <button type="button" disabled={busy} onClick={() => run("retry")}>Retry next 25 failed emails</button>
      <button type="button" disabled={busy} onClick={() => request().catch((error) => setMessage(error.message))}>Refresh delivery counts</button>
    </div>
    <ul>{summary.map((row) => <li key={`${row.kind}-${row.delivery_status}`}>{row.kind} · {row.delivery_status}: {row.count}</li>)}</ul>
    <p role="status" aria-live="polite">{busy ? "Processing email batch…" : message}</p>
    <button type="button" onClick={async () => {
      const response = await fetch("/api/logout", { method: "POST" });
      if (response.ok || response.status === 401) window.location.assign("/login/admin");
    }}>Log out</button>
  </section>;
}
