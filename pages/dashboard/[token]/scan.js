import { Button } from "@mui/material";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { arrivalRequest } from "../../../lib/app/arrival-client";
import { scanQr } from "../../../lib/app/scan-qr";
import styles from "../../../components/ArrivalCheckIn/ArrivalCheckIn.module.scss";

const messages = {
  queued: "Scan sent. Ask the laptop volunteer to confirm check-in.",
  alreadyCheckedIn: "This dancer is already checked in.",
  invalid:
    "Invalid or expired festival QR. Ask the dancer to open their festival QR again.",
};

export default function FestivalScanner() {
  const [checking, setChecking] = useState(false);
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingQr, setPendingQr] = useState(null);
  const video = useRef(null);
  const activeScan = useRef(null);

  useEffect(() => () => activeScan.current?.abort(), []);

  const send = async (qr) => {
    setPendingQr(qr);
    setChecking(true);
    setMessage("");
    try {
      const { status } = await arrivalRequest("scan", { qr });
      setPendingQr(null);
      setMessage(messages[status]);
    } catch {
      setMessage("Could not send the scan. Check your connection and retry.");
    } finally {
      setChecking(false);
    }
  };

  const start = async () => {
    if (activeScan.current || !video.current) return;
    const controller = new AbortController();
    activeScan.current = controller;
    setPendingQr(null);
    setCamera(true);
    setMessage("");
    try {
      const qr = await scanQr(video.current, controller.signal);
      if (controller.signal.aborted) return;
      setCamera(false);
      await send(qr);
    } catch {
      if (!controller.signal.aborted)
        setMessage("Camera unavailable. Allow camera access and try again.");
    } finally {
      activeScan.current = null;
      if (!controller.signal.aborted) setCamera(false);
    }
  };

  return (
    <>
      <Head>
        <title>Festival check-in scanner · Blues Fever</title>
      </Head>
      <main className={styles.scanner}>
        <h1>Festival check-in scanner</h1>
        <p>Scan the dancer’s festival QR from the Blues Fever app.</p>
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          hidden={!camera}
          aria-label="Camera preview"
        />
        {camera ? (
          <Button
            variant="outlined"
            onClick={() => {
              activeScan.current?.abort();
              setCamera(false);
            }}
          >
            Cancel camera
          </Button>
        ) : (
          <>
            <Button
              variant={pendingQr ? "outlined" : "contained"}
              onClick={start}
              disabled={checking}
            >
              Scan a QR code
            </Button>
            {pendingQr && (
              <Button
                variant="contained"
                onClick={() => send(pendingQr)}
                disabled={checking}
              >
                Retry sending scan
              </Button>
            )}
          </>
        )}
        <p role="status">{checking ? "Sending scan…" : message}</p>
      </main>
    </>
  );
}

export function getServerSideProps({ res }) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  return { props: {} };
}
