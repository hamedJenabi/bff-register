export async function arrivalRequest(action, body) {
  const response = await fetch(`/api/check-in/${action}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    ...(body !== undefined && {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      data.error || "Could not connect to festival check-in.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
