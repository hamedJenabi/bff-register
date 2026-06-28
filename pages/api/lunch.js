import { getConfirmedUserByEmailAndName, setUserLunchById } from "../../db/db";

export default async function lunch(req, response) {
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
  if (userToUpdate) {
    await setUserLunchById(
      userToUpdate.id,
      requestData.lunch,
      toPay.toString()
    );
    response.status(200).json();
  }
}
