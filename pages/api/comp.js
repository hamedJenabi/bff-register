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
