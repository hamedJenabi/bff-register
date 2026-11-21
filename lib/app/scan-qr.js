export async function scanQr(video, signal) {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("Camera unavailable");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 960 } },
  });
  let timer;
  let rejectScan;
  const stop = () => {
    window.clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };
  const cancel = () => {
    stop();
    rejectScan?.(signal.reason);
  };
  signal.addEventListener("abort", cancel, { once: true });

  try {
    signal.throwIfAborted();
    const { default: decode } = await import("jsqr");
    signal.throwIfAborted();
    video.srcObject = stream;
    await video.play();
    signal.throwIfAborted();

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Camera frames unavailable");
    return await new Promise((resolve, reject) => {
      rejectScan = reject;
      timer = window.setInterval(() => {
        try {
          if (
            !stream
              .getVideoTracks()
              .some((track) => track.readyState === "live")
          ) {
            reject(new Error("Camera stopped"));
            return;
          }
          if (
            video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
            !video.videoWidth ||
            !video.videoHeight
          )
            return;
          const scale = Math.min(
            1,
            800 / Math.max(video.videoWidth, video.videoHeight),
          );
          const width = Math.round(video.videoWidth * scale);
          const height = Math.round(video.videoHeight * scale);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          context.drawImage(video, 0, 0, width, height);
          const frame = context.getImageData(0, 0, width, height);
          const result = decode(frame.data, width, height, {
            inversionAttempts: "attemptBoth",
          });
          if (result) resolve(result.data);
        } catch (error) {
          reject(error);
        }
      }, 180);
    });
  } finally {
    signal.removeEventListener("abort", cancel);
    stop();
  }
}
