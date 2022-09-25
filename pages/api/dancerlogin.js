import { getUserByEmailAndPassword } from "../../db/db";
const bcrypt = require("bcrypt");

export default async function login(req, response) {
  const email = req.body.email;
  const password = req.body.password;
  const user = await getUserByEmailAndPassword(email, password);

  if (user) {
    response.status(200).json();
  } else {
    response.status(401).json();
  }
}

// to hash via bcrypt
// const bcrypt = require("bcrypt");
// bcrypt.genSalt(10, (err, salt) => {
//   bcrypt.hash(plaintextPassword, salt, function (err, hash) {
//     // Store hash in the database
//   });
// });
