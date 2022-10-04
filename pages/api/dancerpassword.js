import { setUserPassword, getUserByEmail } from "../../db/db";
const bcrypt = require("bcrypt");

export default async function dancerpassword(req, response) {
  console.log("req.bodqqy", req.body);
  const email = req.body.email;
  const password = req.body.password;
  let user = null;
  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async function (err, hash) {
      user = await getUserByEmail(email);
      console.log("user", user);
      if (user) {
        await setUserPassword(email, hash);
        response.status(200).json();
      } else {
        response.status(401).json();
      }
    });
  });
}

// to hash via bcrypt
// const bcrypt = require("bcrypt");
// bcrypt.genSalt(10, (err, salt) => {
//   bcrypt.hash(plaintextPassword, salt, function (err, hash) {
//     // Store hash in the database
//   });
// });
