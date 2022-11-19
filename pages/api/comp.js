import {
  getConfirmedUserByEmailAndName,
  setUserLunchById,
  setUserCompById,
} from "../../db/db";

export default async function comp(req, response) {
  const requestData = {
    email: req.body.email,
    first_name: req.body.firstName,
    last_name: req.body.lastName,
    competition_role: req.body.competition_role.toString(),
    competitions: req.body.competitions.toString(),
  };
  const userToUpdate = await getConfirmedUserByEmailAndName(requestData.email);
  if (!userToUpdate) {
    response.status(404).json();
    return;
  }

  const toPay =
    userToUpdate?.ticket === "fullpass"
      ? req.body.competitions.length * 10 - 10
      : req.body.competitions.length * 10;

  console.log("req.body.competitions", userToUpdate);
  if (userToUpdate) {
    console.log("requestData", requestData);
    await setUserCompById(
      userToUpdate.id,
      requestData.competition_role,
      requestData.competitions,
      toPay
    );
    response.status(200).json();
  }
}
