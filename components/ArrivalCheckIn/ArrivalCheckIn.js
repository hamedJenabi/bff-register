import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { arrivalRequest } from "../../lib/app/arrival-client";
import styles from "./ArrivalCheckIn.module.scss";

export default function ArrivalCheckIn({ scannerPath, setCheckedInIds }) {
  const [scan, setScan] = useState(null);
  const [connection, setConnection] = useState("Connecting to check-in…");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const version = useRef(0);

  const publish = useCallback(
    ({ scan, checkedInIds }) => {
      setScan(scan);
      setCheckedInIds((current) =>
        current.size === checkedInIds.length &&
        checkedInIds.every((id) => current.has(id))
          ? current
          : new Set(checkedInIds),
      );
      setConnection("");
    },
    [setCheckedInIds],
  );

  useEffect(() => {
    let active = true;
    let timer;
    const poll = async () => {
      const requestVersion = version.current;
      let delay = 1000;
      try {
        const result = await arrivalRequest("dashboard");
        if (active && requestVersion === version.current) publish(result);
      } catch (error) {
        delay = 3000;
        if (active && requestVersion === version.current) {
          if (error.status === 401) {
            setScan(null);
            setConnection("Sign in again to receive check-in scans.");
            return;
          }
          setConnection("Check-in connection interrupted. Reconnecting…");
        }
      }
      if (active) timer = window.setTimeout(poll, delay);
    };
    void poll();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [publish]);

  const resolve = async (action) => {
    const { id } = scan;
    setResolving(true);
    setResolveError(null);
    try {
      const result = await arrivalRequest("resolve", { action, id });
      version.current += 1;
      publish(result);
    } catch (error) {
      setResolveError({ id, message: error.message });
    } finally {
      setResolving(false);
    }
  };

  return (
    <section className={styles.control} aria-label="Festival check-in">
      <Button
        variant="outlined"
        href={scannerPath}
        target="_blank"
        rel="noreferrer"
      >
        Open phone scanner
      </Button>
      <span role="status">{connection || "Ready for check-in scans"}</span>

      <Dialog
        open={!!scan}
        aria-labelledby="festival-arrival-title"
        maxWidth="xs"
        fullWidth
      >
        {scan && (
          <>
            <DialogTitle id="festival-arrival-title">
              Check in {scan.name}
            </DialogTitle>
            <DialogContent>
              <dl className={styles.details}>
                <dt>Pass</dt>
                <dd>{scan.pass}</dd>
                <dt>Lunch</dt>
                <dd>{scan.lunch.join(", ") || "None"}</dd>
                <dt>T-shirt</dt>
                <dd>{scan.tshirt || "None"}</dd>
                <dt>Competition</dt>
                <dd>{scan.competitions.join(", ") || "None"}</dd>
              </dl>
              {scan.competitions.length > 0 && (
                <p className={styles.desk}>Send to the competition desk</p>
              )}
              {connection && <p role="status">{connection}</p>}
              {resolveError?.id === scan.id && (
                <p role="alert">{resolveError.message}</p>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => resolve("dismiss")} disabled={resolving}>
                Dismiss scan
              </Button>
              <Button
                onClick={() => resolve("confirm")}
                disabled={resolving}
                variant="contained"
              >
                Check in
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </section>
  );
}
