const ADMIN_USER = process.env.ADMIN_USER;
const HASHED_PASS = process.env.HASHED_PASS;

export default async function login(req, response) {
  const admin = {
    user_name: req.body.userName,
    password: req.body.password,
  };

  if (admin.user_name === ADMIN_USER && admin.password === HASHED_PASS) {
    response.status(200).json();
  } else {
    response.status(401).json();
  }
}
