import { registrationStore } from "../../db/reg2026";
import { getConfirmedUserByEmailAndName, setUserLunchById } from "../../db/db";

export default async function lunch(req, response) {
  response.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { response.setHeader("Allow", "POST"); return response.status(405).end(); }
  if (process.env.REG2026_ENABLED === "true") {
    return response.status(410).json({ error: "Use your signed 2026 registration invitation to book festival choices." });
  }
  const requestData = {
    email: req.body.email,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    lunch: req.body.lunch.toString(),
  };
  const toPay = req.body.lunch.length * 15;

  const userToUpdate = await getConfirmedUserByEmailAndName(
    requestData.email,
    requestData.firstname
  );
  if (!userToUpdate) {
    response.status(404).json();
    return;
  }
  if (await registrationStore.hasOrders(userToUpdate.id)) {
    return response.status(410).json({ error: "Use your signed 2026 registration link to edit these choices." });
  }
  if (userToUpdate) {
    await setUserLunchById(
      userToUpdate.id,
      requestData.lunch,
      toPay.toString()
    );
    response.status(200).json();
  }
}
