import {
  getConfirmedUserByEmailAndName,
  setUserLunchById,
  setUserCompById,
} from "../../db/db";

export default async function comp(req, response) {
  const requestData = {
    email: req.body.email,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    competition_role: req.body.competition_role.toString(),
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

  if (userToUpdate) {
    await setUserCompById(
      userToUpdate.id,
      requestData.competition_role,
      requestData.competitions,
      toPay
    );
    response.status(200).json();
  }
}
