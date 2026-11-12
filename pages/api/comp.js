import { registrationStore } from "../../db/reg2026";
import {
  getConfirmedUserByEmailAndName,
  setUserLunchById,
  setUserCompById,
} from "../../db/db";

export default async function comp(req, response) {
  response.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { response.setHeader("Allow", "POST"); return response.status(405).end(); }
  if (process.env.REG2026_ENABLED === "true") {
    return response.status(410).json({ error: "Use your signed 2026 registration invitation to book festival choices." });
  }
  const requestData = {
    email: req.body.email,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    open_mixnmatch_role: req.body.open_mixnmatch_role,
    newcomers_mixnmatch_role: req.body.newcomers_mixnmatch_role,
    strictly_role: req.body.strictly_role,
    competitions: req.body.competitions.toString(),
  };
  const userToUpdate = await getConfirmedUserByEmailAndName(
    requestData.email,
    requestData.firstname
  );

  if (!userToUpdate) {
    response.status(404).json();
    return;
  }

  const toPay =
    userToUpdate?.ticket === "fullpass"
      ? req.body.competitions.length * 10 - 10
      : req.body.competitions.length * 10;

  if (await registrationStore.hasOrders(userToUpdate.id)) {
    return response.status(410).json({ error: "Use your signed 2026 registration link to edit these choices." });
  }
  if (userToUpdate) {
    await setUserCompById(
      userToUpdate.id,
      requestData.open_mixnmatch_role,
      requestData.newcomers_mixnmatch_role,
      requestData.strictly_role,
      requestData.competitions,
      toPay
    );
    response.status(200).json();
  }
}
