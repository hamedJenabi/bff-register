require("dotenv").config();
require("../extractHerokuDatabaseEnvVars")();
// const argon2 = require("argon2");

const postgres = require("postgres");
const sql =
  process.env.NODE_ENV === "production"
    ? // Heroku needs SSL connections but
      // has an "unauthorized" certificate
      // https://devcenter.heroku.com/changelog-items/852
      postgres({ ssl: { rejectUnauthorized: false } })
    : postgres();

export async function getTickets() {
  const tickets = await sql`
      SELECT id, name, capacity, waiting_list FROM tickets_23
      `;
  return tickets;
}
export async function updateTicketCapacity(ticketId) {
  await sql`
    UPDATE tickets_23
    SET capacity = capacity - 1
    WHERE id = ${ticketId}
    `;
}
export async function updateTicketWaiting(ticketId) {
  await sql`
    UPDATE tickets_23
    SET waiting_list = waiting_list - 1
    WHERE id = ${ticketId}
    `;
}
export async function removeFromCapacity(ticketId) {
  await sql`
    UPDATE tickets_23
    SET capacity = capacity + 1
    WHERE id = ${ticketId}
    `;
}
export async function addToWaitingList(ticketId) {
  await sql`
    UPDATE tickets_23
    SET waiting_list = waiting_list - 1
    WHERE id = ${ticketId}
    `;
}
export async function addToCapacity(ticketId) {
  await sql`
    UPDATE tickets_23
    SET capacity = capacity - 1
    WHERE id = ${ticketId}
    `;
}
export async function removeFromWaitingList(ticketId) {
  await sql`
    UPDATE tickets_23
    SET waiting_list = waiting_list + 1
    WHERE id = ${ticketId}
    `;
}
export async function getTicketByName(name) {
  const ticket = await sql`
    SELECT * FROM tickets_23 WHERE name=${name}
    `;
  return ticket[0];
}
export async function isTicketAvailable(id) {
  const ticket = await sql`
    SELECT * FROM tickets_23 WHERE id=${id}
    `;
  return ticket[0];
}

export async function insertRegistration(user) {
  const userData = {
    status: user.status,
    date: user.date,
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    country: user.country,
    ticket: user.ticket,
    parent_partner: user.parent_partner,
    role: user.role,
    level: user.level,
    theme_class: user.theme_class,
    competition: user.competition,
    open_mixnmatch_role: user.open_mixnmatch_role,
    newcomers_mixnmatch_role: user.newcomers_mixnmatch_role,
    strictly_role: user.strictly_role,
    competitions: user.competitions.toString(),
    tshirt: user.tshirt,
    lunch: user.lunch,
    donation: user.donation_amount,
    price: user.price,
    terms: user.terms,
  };

  return sql`
  INSERT INTO registrations_23${sql(
    userData,
    "status",
    "date",
    "email",
    "firstname",
    "lastname",
    "country",
    "ticket",
    "parent_partner",
    "role",
    "level",
    "theme_class",
    "competition",
    "open_mixnmatch_role",
    "newcomers_mixnmatch_role",
    "strictly_role",
    "competitions",
    "tshirt",
    "price",
    "lunch",
    "donation",
    "terms"
  )}
RETURNING id
  `;
}

export async function getAllUsers() {
  const users = await sql`
      SELECT * FROM registrations_23
    `;
  return users;
}

export async function getUserById(id) {
  const user = await sql`
    SELECT * FROM registrations_23 WHERE id = ${id}
  `;
  return user[0];
}
export async function updateUserInfo(user, totalPrice) {
  const time = new Date();

  const userData = {
    id: user.id,
    date: time.toDateString(),
    status: user.status,
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    country: user.country,
    ticket: user.ticket,
    parent_partner: user.parent_partner,
    role: user.role,
    level: user.level,
    theme_class: user.theme_class,
    competition: user.competition,
    open_mixnmatch_role: user.open_mixnmatch_role,
    newcomers_mixnmatch_role: user.newcomers_mixnmatch_role,
    strictly_role: user.strictly_role,
    competitions: user.competitions,
    tshirt: user.tshirt,
    price: totalPrice,
    terms: true,
  };

  await sql`
  UPDATE registrations_23
  SET 
    "status" = ${userData.status},
    "email" = ${userData.email},
    "date" = ${userData.date},
    "firstname"  = ${userData.firstname},
    "lastname" = ${userData.lastname},
    "country" = ${userData.country},
    "ticket"  = ${userData.ticket},
    "parent_partner" = ${userData.parent_partner},
    "role" = ${userData.role},
    "level" = ${userData.level},
    "theme_class" = ${userData.theme_class || ""},
    "competition" = ${userData.competition},
    "open_mixnmatch_role"= ${userData.open_mixnmatch_role},
    "newcomers_mixnmatch_role"= ${userData.newcomers_mixnmatch_role},
    "strictly_role"= ${userData.strictly_role},
    "competitions" = ${userData.competitions},
    "tshirt" = ${userData.tshirt},
    "price" = ${userData.price},
    "terms" = ${userData.terms}
  WHERE id = ${user.id}
  `;
  return user[0];
}

export async function getConfirmedUserByEmailAndName(email, firstname) {
  const user = await sql`
    SELECT * FROM registrations_23 WHERE email = ${email} AND firstname = ${firstname} AND status = 'confirmed'
  `;
  return user[0];
}
export async function getUserByEmailAndName(email) {
  const user = await sql`
    SELECT * FROM registrations_23 WHERE email = ${email}
  `;
  return user[0];
}
export async function setUserLunchById(id, lunch) {
  await sql`
   UPDATE registrations_23
    SET lunch = ${lunch}
     WHERE id = ${id};
  `;
}
export async function setUserCompById(
  id,
  open_mixnmatch_role,
  newcomers_mixnmatch_role,
  strictly_role,
  competitions,
  to_pay
) {
  await sql`
   UPDATE registrations_23
    SET 
    open_mixnmatch_role = ${open_mixnmatch_role},
    newcomers_mixnmatch_role = ${newcomers_mixnmatch_role},
    strictly_role = ${strictly_role},
    competitions = ${competitions},
    to_pay = ${to_pay}
     WHERE id = ${id};
  `;
}
