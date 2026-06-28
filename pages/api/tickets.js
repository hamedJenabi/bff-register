import { updateTicketRemainingCapacity } from "../../db/db";

export default async function tickets(req, response) {
  if (req.method !== "PATCH" && req.method !== "POST") {
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const ticketId = Number(req.body.ticketId);
  const capacity = Number(req.body.capacity);

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    response.status(400).json({ error: "A valid ticket id is required." });
    return;
  }

  if (
    req.body.capacity === "" ||
    req.body.capacity === null ||
    req.body.capacity === undefined ||
    !Number.isInteger(capacity) ||
    capacity < 0
  ) {
    response
      .status(400)
      .json({ error: "Remaining spots must be a non-negative whole number." });
    return;
  }

  const ticket = await updateTicketRemainingCapacity(ticketId, capacity);

  if (!ticket) {
    response.status(404).json({ error: "Ticket not found." });
    return;
  }

  response.status(200).json({ ticket });
}
