import { getConfirmedUserByEmailAndName, setUserLunchById } from "../../db/db";

export default async function lunch(req, response) {
  const requestData = {
    email: req.body.email,
    first_name: req.body.firstName,
    last_name: req.body.lastName,
    lunch: req.body.lunch.toString(),
  };

  const userToUpdate = await getConfirmedUserByEmailAndName(requestData.email);
  if (!userToUpdate) {
    response.status(404).json({ message: "User not found" });
    return;
  }
  if (userToUpdate) {
    await setUserLunchById(userToUpdate.id, requestData.lunch);
    response.status(200).json({ data: userToUpdate });
  }

  response.status(200).json();
}
