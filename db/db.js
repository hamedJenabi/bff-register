require("dotenv").config();
require("../extractHerokuDatabaseEnvVars")();
// const argon2 = require("argon2");
const bcrypt = require("bcrypt");

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
      SELECT id, name, capacity, waiting_list FROM tickets
      `;
  return tickets;
}
export async function updateTicketCapacity(ticketId) {
  await sql`
    UPDATE tickets
    SET capacity = capacity - 1
    WHERE id = ${ticketId}
    `;
}
export async function updateTicketWaiting(ticketId) {
  await sql`
    UPDATE tickets
    SET waiting_list = waiting_list - 1
    WHERE id = ${ticketId}
    `;
}
export async function removeFromCapacity(ticketId) {
  await sql`
    UPDATE tickets
    SET capacity = capacity + 1
    WHERE id = ${ticketId}
    `;
}
export async function addToWaitingList(ticketId) {
  await sql`
    UPDATE tickets
    SET waiting_list = waiting_list - 1
    WHERE id = ${ticketId}
    `;
}
export async function addToCapacity(ticketId) {
  await sql`
    UPDATE tickets
    SET capacity = capacity - 1
    WHERE id = ${ticketId}
    `;
}
export async function removeFromWaitingList(ticketId) {
  await sql`
    UPDATE tickets
    SET waiting_list = waiting_list + 1
    WHERE id = ${ticketId}
    `;
}
export async function getTicketByName(name) {
  const ticket = await sql`
    SELECT * FROM tickets WHERE name=${name}
    `;
  return ticket[0];
}
export async function isTicketAvailable(id) {
  const ticket = await sql`
    SELECT * FROM tickets WHERE id=${id}
    `;
  return ticket[0];
}

export async function insertRegistration(user) {
  const userData = {
    status: user.status,
    date: user.date,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    country: user.country,
    ticket: user.ticket,
    role: user.role,
    level: user.level,
    theme_class: user.theme_class,
    competition: user.competition,
    competition_role: user.competition_role,
    competitions: user.competitions.toString(),
    price: user.price,
    terms: user.terms,
  };
  return sql`
  INSERT INTO registrations${sql(
    userData,
    "status",
    "date",
    "email",
    "first_name",
    "last_name",
    "country",
    "ticket",
    "role",
    "level",
    "theme_class",
    "competition",
    "competition_role",
    "competitions",
    "price",
    "terms"
  )}
RETURNING id
  `;
}

export async function getAllUsers() {
  const users = await sql`
      SELECT * FROM registrations
    `;
  return users;
}

export async function getUserById(id) {
  const user = await sql`
    SELECT * FROM registrations WHERE id = ${id}
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
    first_name: user.first_name,
    last_name: user.last_name,
    country: user.country,
    ticket: user.ticket,
    role: user.role,
    level: user.level,
    theme_class: user.theme_class,
    competition: user.competition,
    competition_role: user.competition_role,
    competitions: user.competitions,
    price: totalPrice,
    terms: true,
  };

  await sql`
  UPDATE registrations
  SET 
    "status" = ${userData.status},
    "email" = ${userData.email},
    "date" = ${userData.date},
    "first_name"  = ${userData.first_name},
    "last_name" = ${userData.last_name},
    "country" = ${userData.country},
    "ticket"  = ${userData.ticket},
    "role" = ${userData.role},
    "level" = ${userData.level},
    "theme_class" = ${userData.theme_class},
    "competition" = ${userData.competition},
    "competition_role" = ${userData.competition_role},
    "competitions" = ${userData.competitions},
    "price" = ${userData.price},
    "terms" = ${userData.terms}
  WHERE id = ${user.id}
  `;
  return user[0];
}

export async function getUserByEmailAndName(email) {
  const user = await sql`
    SELECT * FROM registrations WHERE email = ${email}
  `;
  return user[0];
}
export async function getUserByEmail(email) {
  const user = await sql`
    SELECT * FROM registrations WHERE email = ${email} AND status = 'confirmed' 
  `;
  return user[0];
}

export async function setUserPassword(email, password) {
  await sql`
   UPDATE registrations
    SET password = ${password}
     WHERE email = ${email};
  `;
}
export async function getUserByEmailAndPassword(email, password) {
  const user = await sql`
    SELECT * FROM registrations WHERE email = ${email} AND password = ${password}
  `;
  if (user?.length > 0) {
    const hash = user[0].password;
    bcrypt.compare(password, hash, function (err, result) {
      if (result) {
        return user[0];
      }
    });
    return null; // password did not match
  }
}
// /* ****** resetpassword****** */
// export async function resetPassword(password_hash, accountId) {
//   await sql`
//   UPDATE accounts
//   SET password_hash = ${password_hash}
//   WHERE id = ${accountId};
//   `;
// }
// export async function getMenteeById(id) {
//   const mentee = await sql`
//     SELECT * FROM mentees WHERE id = ${id}
//   `;
//   return mentee;
// }

// export async function getUserRoleByEmail(email) {
//   const userRole = await sql`
//   SELECT accounts.role
//   FROM
//   accounts
//   WHERE accounts.email = ${email}
//   `;

//   return userRole;
// }

// // export async function getUserByAccountId(id) {
// //   const user = await sql`
// //     SELECT * FROM mentors WHERE account_id = ${id}
// //   `;
// //   return user[0];
// // }

// export async function selectSessionByToken(token) {
//   const session = await sql`
//     SELECT * FROM sessions WHERE token = ${token}
//   `;
//   return session;
// }
// export async function logoutSession(token) {
//   await sql`
//     DELETE FROM sessions WHERE token = ${token}
//   `;
// }

// // export async function selectUserByEmailAndPassword(email, password) {
// //   const usersWithEmail = await sql`
// //   SELECT * FROM accounts WHERE email = ${email}
// //   `;
// //   if (usersWithEmail.length === 0) return usersWithEmail;

// //   const passwordMatches = await argon2.verify(
// //     usersWithEmail[0].password_hash,
// //     password,
// //   ); //this returns boolean

// //   if (passwordMatches) {
// //     return usersWithEmail;
// //   } else {
// //     return [];
// //   }
// // }

// export async function insertSession(userId, token) {
//   return sql`
//   INSERT INTO sessions(account_id, token) VALUES (${userId}, ${token})
//   `;
// }
// export async function removeExpiredSessions() {
//   await sql`
//   DELETE FROM sessions WHERE expiry_timestamp < NOW();
//   `;
// }

// export async function getTags() {
//   const tags = await sql`
//       SELECT * FROM tags
//       `;
//   return tags;
// }

// export async function getCharacteristics() {
//   const characteristics = await sql`
//   SELECT * FROM characteristics
//   `;

//   return characteristics;
// }

// //mb make it to like query from multiple tables => tags, chars, questions
// export async function getInfoByMenteeId(menteeId) {
//   const tags = await sql`
//       SELECT tags.id, tags.type, tags.label, mentees.relationship, mentees.motivation, mentees.moreinfo, mentees.id AS mentee_id, mentees_tags.mentee_id AS id_id
//       FROM
//       mentees_tags,
//       tags,
//       mentees,
//       accounts
//       WHERE
//       mentees_tags.mentee_id = ${menteeId} AND
//       mentees_tags.tag_id = tags.id AND
//       mentees.account_id = accounts.id AND
// mentees.id = ${menteeId}

//       `;

//   return tags;
// }

// export async function getInfoByMentorId(mentorId) {
//   const tags = await sql`
//       SELECT tags.id, tags.type, tags.label, mentors.relationship, mentors.motivation, mentors.moreinfo, mentors.id AS mentor_id, mentors_tags.mentor_id AS id_id
//       FROM
//       mentors_tags,
//       tags,
//       mentors,
//       accounts
//       WHERE
//       mentors_tags.mentor_id IN (${mentorId}) AND
//       mentors_tags.tag_id = tags.id AND
//       mentors.account_id = accounts.id AND
//       mentors.id IN (${mentorId})
//       `;

//   return tags;
// }

// export async function getQuestionAnswersByMentorId(mentorId) {
//   const answers = await sql`
//   SELECT questions.question, answers.answer, question_answers.id, mentors_question_answers.mentor_id AS mentor_id
//   FROM
//   questions,
//   answers,
//   question_answers,
//   mentors_question_answers
//   WHERE
//   mentors_question_answers.mentor_id IN (${mentorId}) AND
//   mentors_question_answers.question_answer_id = question_answers.id AND
//   question_answers.question_id = questions.id AND
//   question_answers.answer_id = answers.id
//   `;
//   return answers;
// }

// export async function getQuestionAnswersByMenteeId(menteeId) {
//   const answers = await sql`
//   SELECT questions.question, answers.answer, question_answers.id
//   FROM
//   questions,
//   answers,
//   question_answers,
//   mentees_question_answers
//   WHERE
//   mentees_question_answers.mentee_id = ${menteeId} AND
//   mentees_question_answers.question_answer_id = question_answers.id AND
//   question_answers.question_id = questions.id AND
//   question_answers.answer_id = answers.id
//   `;
//   return answers;
// }
// export async function getCharacteristicsByMentorId(mentorId) {
//   const char = await sql`
//   SELECT characteristics.id, characteristics.label_minus, characteristics.label_plus, mentors_characteristics.value
//   FROM
//   characteristics,
//   mentors_characteristics

//   WHERE
//   characteristics.id = mentors_characteristics.characteristic_id AND
//   mentors_characteristics.mentor_id = ${mentorId}
//   `;
//   return char;
// }

// export async function getMentorsByTagId(tagId) {
//   const mentorIds = await sql`
//       SELECT * FROM mentors_tags WHERE tag_Id=${tagId}
//       `;
//   return mentorIds;
// }

// export async function checkUserEmail(email) {
//   const usersWithEmail = await sql`
//   SELECT *
//    FROM
//   accounts
//   WHERE
//   accounts.email = ${email}
//   `;

//   return usersWithEmail;
// }

// export async function getUpcomingEvents() {
//   const events = await sql`
//   SELECT * FROM events
//   `;

//   return events;
// }

// export async function insertUserAccount(user) {
//   const userWithHashedPassword = {
//     email: user.email,
//     password_hash: user.password_hash,
//     first_name: user.first_name,
//     last_name: user.last_name,
//     role: user.role,
//     year_of_birth: user.year_of_birth,
//     phone: user.phone,
//     gender: user.gender,
//     city: user.city,
//     country: user.country,
//     occupation_status: user.occupation_status,
//     position: user.position,
//     company: user.company,
//     website: user.website,
//     newsletter: user.newsletter,
//     marketing_media: user.marketing_media,
//   };
//   return sql`
//   INSERT INTO accounts${sql(
//     userWithHashedPassword,
//     "email",
//     "password_hash",
//     "first_name",
//     "last_name",
//     "year_of_birth",
//     "phone",
//     "gender",
//     "role",
//     "city",
//     "country",
//     "occupation_status",
//     "position",
//     "company",
//     "website",
//     "newsletter",
//     "marketing_media"
//   )}
// RETURNING id
//   `;
// }

// export async function insertMenteeAccount(
//   userId,
//   membership,
//   tagsIds,
//   questionAnswerIds,
//   characteristicIds,
//   values,
//   preferredCity,
//   relationship,
//   motivation,
//   moreInfo
// ) {
//   const menteeId = await sql`
//     INSERT INTO mentees
//     (account_id, membership, relationship, motivation, moreinfo, preferred_city)
//     VALUES (${userId}, ${membership},
//     ${relationship},${motivation}, ${moreInfo}, ${preferredCity})
//     RETURNING id
//   `;

//   await sql`
//   INSERT INTO mentees_tags (mentee_id, tag_id)
//   SELECT ${menteeId[0].id}, x
//   FROM unnest(ARRAY[${tagsIds}]) x
//   `;

//   await sql`
// INSERT INTO mentees_question_answers(mentee_id, question_answer_id)
// SELECT ${menteeId[0].id}, x
// FROM unnest(ARRAY[${questionAnswerIds}]) x
// `;

//   await sql`
//   INSERT INTO mentees_characteristics(mentee_id, characteristic_id, value) VALUES (${menteeId[0].id},
//   unnest(ARRAY[${characteristicIds}]),
//   unnest(ARRAY[${values}]))

//   `;
//   return menteeId[0].id;
// }
// /*******  insert Matches into TABLE */

// export async function insertMatches(menteeId, mentorId, compatibility) {
//   await sql`
//   INSERT INTO match_suggestions (
//   mentee_id,
//   mentor_id,
//   compatibility
//    )
//   VALUES (${menteeId},
//   unnest(ARRAY[${mentorId}]),
//   unnest(ARRAY[${compatibility}]))

// `;
// }

// export async function insertMentorAccount(
//   userId,
//   certificate,
//   tagsIds,
//   questionAnswerIds,
//   characteristicIds,
//   values,
//   relationship,
//   motivation,
//   moreInfo
// ) {
//   const mentorId = await sql`
//     INSERT INTO mentors
//     (account_id, certificate, relationship, motivation, moreinfo)
//     VALUES (${userId}, ${certificate},
//     ${relationship},${motivation}, ${moreInfo})
//     RETURNING id
//   `;

//   await sql`
//     INSERT INTO mentors_tags (mentor_id, tag_id)
//     SELECT ${mentorId[0].id}, x
//     FROM unnest(ARRAY[${tagsIds}]) x
//   `;

//   await sql`
// INSERT INTO mentors_question_answers(mentor_id, question_answer_id)
// SELECT ${mentorId[0].id}, x
// FROM unnest(ARRAY[${questionAnswerIds}]) x
// `;

//   await sql`
//   INSERT INTO mentors_characteristics(mentor_id, characteristic_id, value) VALUES (${mentorId[0].id},
//   unnest(ARRAY[${characteristicIds}]),
//   unnest(ARRAY[${values}]))

//   `;
// }

// export async function getQuestionAnswers() {
//   const questionAnswer = await sql`
//   SELECT question_answers.id, question_answers.question_id, question_answers.answer_id, questions.question, answers.answer
//   FROM
//   question_answers,
//   questions,
//   answers
//   WHERE
//   question_answers.question_id = questions.id AND
//   question_answers.answer_id = answers.id
//   `;
//   return questionAnswer;
// }

// /************* Matching process ******************/
// /*********get mentee Tags and Characteristics for matching ********/
// export async function getTagsByMenteeId(menteeId) {
//   const tags = await sql`
//       SELECT  tags.id, tags.type
//       FROM
//       mentees_tags,
//       tags
//       WHERE
//       mentees_tags.mentee_id = ${menteeId} AND
//       tags.id = mentees_tags.tag_id
//       `;
//   return tags;
// }
// export async function getCharacteristicsByMenteeId(menteeId) {
//   const characteristics = await sql`
//       SELECT characteristics.id AS id
//       FROM
//       mentees_characteristics,
//       characteristics
//       WHERE
//       mentees_characteristics.mentee_id = ${menteeId} AND
//       mentees_characteristics.characteristic_id = characteristics.id AND
//       mentees_characteristics.value='100' OR '0'
//       `;
//   return characteristics;
// }

// export async function getAvailableMentorsByMenteeIdAndTagId(menteeId) {
//   const mentorsIdAndTagType = await sql`
//       SELECT mentors.id AS mentors_id, tags.id AS tag_id, tags.type AS tag_type, accounts.city AS mentor_city FROM
//         mentees_tags,
//         mentors_tags,
//         mentors,
//         tags,
//         accounts
//         WHERE
//         mentees_tags.mentee_id=${menteeId} AND
//         tags.id = mentees_tags.tag_id AND
//         mentors_tags.tag_id=tags.id AND
//         mentors.id = mentors_tags.mentor_id AND
//         mentors.account_id=accounts.id AND
//         mentors.mentee_capacity > 0
//       `;
//   return mentorsIdAndTagType;
// }

// export async function getAvailableMentorsByMenteeIdAndCharacteristicId(
//   menteeId
// ) {
//   const mentorsByCharacteristics = await sql`
//       SELECT mentors.id AS mentors_id,  mentees_characteristics.characteristic_id AS characteristic_id, mentors_characteristics.value AS mentors_characteristics_value, mentees_characteristics.value AS mentees_characteristics_value, accounts.city AS mentor_city FROM
//       mentees_characteristics,
//       mentors_characteristics,
//       mentors,
//       accounts
//       WHERE
//       mentees_characteristics.mentee_id=${menteeId} AND
//       mentors_characteristics.characteristic_id=mentees_characteristics.characteristic_id AND
//       mentors.id=mentors_characteristics.mentor_id AND
//       mentors.account_id=accounts.id AND
//       mentors.mentee_capacity > 0
//       `;

//   return mentorsByCharacteristics;
// }
// /********** LGBTIQ**********/
// export async function getMenteeLgbtigPreferenceById(menteeId) {
//   const menteeLgbtigPreference = await sql`
//       SELECT answers.answer AS answer FROM
//       mentees_question_answers,
//       question_answers,
//       answers
//       WHERE
//       mentees_question_answers.mentee_id=${menteeId} AND
//       mentees_question_answers.question_answer_id=question_answers.id AND
//       question_answers.question_id = 4 AND
//       answers.id=question_answers.answer_id
//       `;
//   return menteeLgbtigPreference;
// }
// export async function getMentorLgbtigAnswerById(mentorId) {
//   const mentorLgbtigPreference = await sql`
//       SELECT answers.answer AS answer FROM
//       mentors_question_answers,
//       question_answers,
//       answers
//       WHERE
//       mentors_question_answers.mentor_id=${mentorId} AND
//       mentors_question_answers.question_answer_id=question_answers.id AND
//       question_answers.question_id = 4 AND
//       answers.id=question_answers.answer_id
//       `;
//   return mentorLgbtigPreference;
// }

// // here we should see if mentee wants the same city mentor
// export async function getMenteeCityPreferenceById(menteeId) {
//   const menteeCityAndPreference = await sql`
//       SELECT accounts.city AS city, mentees.preferred_city AS preferred_city  FROM
//       mentees,
//       accounts
//       WHERE
//       mentees.id=${menteeId} AND
//       mentees.account_id=accounts.id
//       `;
//   return menteeCityAndPreference[0];
// }

// export async function getMentorById(id) {
//   const mentor = await sql`
//       SELECT * FROM mentors WHERE id=${id}
//       `;
//   return mentor;
// }
// //currently not in use
// // export async function updateAccount(accountId, user) {
// //   return sql`
// //   UPDATE accounts
// //   SET role = 'BOTH',
// //     first_name = ${user.firstName},
// //     last_name = ${user.lastName},
// //     year_of_birth = ${user.yearOfBirth},
// //     phone = ${user.phone},
// //     gender = ${user.gender},
// //     city = ${user.city},
// //     country = ${user.country},
// //     occupation_status = ${user.occupationStatus},
// //     position = ${user.position},
// //     company = ${user.company},
// //     website = ${user.website}

// // WHERE id = ${accountId};
// //   `;
// // }

// export async function getUserIdByEmail(email) {
//   const userId = await sql`
// SELECT accounts.id
// FROM accounts
// WHERE email = ${email}
// `;

//   return userId[0].id;
// }

// export async function getPotentialMatchesByMenteeId(menteeAccId) {
//   const matches = await sql`
//  SELECT accounts.first_name, accounts.last_name, accounts.email, accounts.city, accounts.phone, accounts.website, accounts.position, accounts.company, match_suggestions.compatibility, mentors.id,  mentors.mentee_capacity, accounts.id AS account_id
//  FROM
//  accounts,
//  mentees,
//  mentors,
//  match_suggestions
//  WHERE
//  mentees.account_id = ${menteeAccId} AND
//  mentors.account_id = accounts.id AND
//  match_suggestions.mentor_id = mentors.id AND
//  match_suggestions.mentee_id = mentees.id

//  `;
//   return matches;
// }

// export async function getMenteeIdByAccId(accId) {
//   const menteeId = await sql`
//   SELECT mentees.id FROM mentees WHERE mentees.account_id = ${accId}
//   `;
//   return menteeId[0].id;
// }

// export async function getMentorIdByAccId(accId) {
//   const mentorId = await sql`
//   SELECT mentors.id FROM mentors WHERE mentors.account_id = ${accId}
//   `;

//   return mentorId[0].id;
// }

// export async function insertFinalMatch(menteeId, mentorId, compatibility) {
//   await sql`
//   INSERT INTO match (mentee_id, mentor_id, compatibility) VALUES (${menteeId}, ${mentorId}, ${compatibility} )
//   `;
// }

// export async function removePossibleMatches(menteeId) {
//   await sql`
// DELETE FROM match_suggestions WHERE mentee_id IN(${menteeId})
// `;
// }

// export async function getNameAndEmailByMenteeId(menteeId) {
//   const mentee = await sql`
//   SELECT accounts.first_name, accounts.last_name, accounts.email
//   FROM
//   accounts,
//   mentees
//   WHERE
//   mentees.account_id = accounts.id AND
//   mentees.id = ${menteeId}
//   `;
//   return mentee;
// }
// export async function getNameAndEmailByMentorId(mentorId) {
//   const mentor = await sql`
//   SELECT accounts.first_name, accounts.last_name, accounts.email
//   FROM
//   accounts,
//   mentors
//   WHERE
//   mentors.account_id = accounts.id AND
//   mentors.id = ${mentorId}
//   `;
//   return mentor;
// }

// export async function getMatchesByMenteeId(menteeId) {
//   const matches = await sql`
//   SELECT accounts.id, accounts.first_name, accounts.last_name, accounts.email, accounts.position, accounts.company, accounts.city, accounts.country, accounts.phone, accounts.website, mentors.id AS mentor_id
//   FROM accounts, match, mentors
//   WHERE match.mentee_id = ${menteeId} AND
//   mentors.id = match.mentor_id AND
//   accounts.id = mentors.account_id
//   `;
//   return matches;
// }

// export async function getMatchesByMentorId(mentorId) {
//   const matches = await sql`
//   SELECT  accounts.id, accounts.first_name, accounts.last_name, accounts.email, accounts.position, accounts.company, accounts.city, accounts.country, accounts.phone, accounts.website, mentees.id AS mentee_id
//   FROM accounts, match, mentees
//   WHERE match.mentor_id = ${mentorId} AND
//   accounts.id = mentees.account_id AND
//   mentees.id = match.mentee_id
//   `;
//   return matches;
// }

// export async function checkMatchByMenteeAndMentorId(menteeId, mentorIds) {
//   const match = await sql`
//   SELECT * FROM match
//   WHERE mentee_id = ${menteeId} AND
//   mentor_id IN (${mentorIds})

//   `;
//   return match;
// }

// export async function selectMenteesForFeedbackEmailOneMonth() {
//   const mentees = await sql`
//   SELECT mentees.id AS mentee_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentee_id = mentees.id AND
//   mentees.account_id = accounts.id AND
//   match.email_one_month_sent = false AND
//   match.mentor_id = mentors.id

//   `;

//   return mentees;
// }

// export async function selectMentorsForFeedbackEmailOneMonth() {
//   const mentors = await sql`
//   SELECT mentors.id AS mentor_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentor_id = mentors.id AND
//   mentors.account_id = accounts.id AND
//   match.email_one_month_sent = false AND
//   match.mentee_id = mentees.id

//   `;

//   return mentors;
// }

// export async function toggleEmailOneMonth(mentorId, menteeId) {
//   await sql`
//   UPDATE match
//   SET email_one_month_sent = true
//   WHERE match.mentor_id IN (${mentorId}) AND
//   match.mentee_id IN (${menteeId})
//   `;
// }

// export async function selectMenteesForFeedbackEmailThreeMonths() {
//   const mentees = await sql`
//   SELECT mentees.id AS mentee_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentee_id = mentees.id AND
//   mentees.account_id = accounts.id AND
//   match.email_three_months_sent = false AND
//   match.email_one_month_sent = true AND
//   match.mentor_id = mentors.id

//   `;

//   return mentees;
// }

// export async function selectMentorsForFeedbackEmailThreeMonths() {
//   const mentors = await sql`
//   SELECT mentors.id AS mentor_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentor_id = mentors.id AND
//   mentors.account_id = accounts.id AND
//   match.email_three_months_sent = false AND
//   match.email_one_month_sent = true AND
//   match.mentee_id = mentees.id

//   `;

//   return mentors;
// }

// export async function toggleEmailThreeMonths(mentorId, menteeId) {
//   await sql`
//   UPDATE match
//   SET email_three_months_sent = true
//   WHERE match.mentor_id IN (${mentorId}) AND
//   match.mentee_id IN (${menteeId}) AND
//   match.email_one_month_sent = true
//   `;
// }

// export async function selectMenteesForFeedbackEmailSixMonths() {
//   const mentees = await sql`
//   SELECT mentees.id AS mentee_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentee_id = mentees.id AND
//   mentees.account_id = accounts.id AND
//   match.email_six_months_sent = false AND
//   match.email_one_month_sent = true AND
//   match.email_three_months_sent = true AND
//   match.mentor_id = mentors.id

//   `;

//   return mentees;
// }

// export async function selectMentorsForFeedbackEmailSixMonths() {
//   const mentors = await sql`
//   SELECT mentors.id AS mentor_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentor_id = mentors.id AND
//   mentors.account_id = accounts.id AND
//   match.email_six_months_sent = false AND
//   match.email_one_month_sent = true AND
//   match.email_three_months_sent = true AND
//   match.mentee_id = mentees.id

//   `;

//   return mentors;
// }

// export async function toggleEmailSixMonths(mentorId, menteeId) {
//   await sql`
//   UPDATE match
//   SET email_six_months_sent = true
//   WHERE match.mentor_id IN (${mentorId}) AND
//   match.mentee_id IN (${menteeId}) AND
//   match.email_one_month_sent = true AND
//   match.email_three_months_sent = true
//   `;
// }

// export async function selectUsersForFeedbackEmailTenMonths() {
//   const mentors = await sql`
//   SELECT mentors.id AS mentor_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentor_id = mentors.id AND
//   mentors.account_id = accounts.id AND
//   match.email_eleven_months_sent = false AND
//   match.email_six_months_sent = true AND
//   match.email_three_months_sent = true AND
//   match.email_one_month_sent = true AND
//   match.mentee_id = mentees.id

//   `;

//   const mentees = await sql`
//   SELECT mentees.id AS mentee_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentee_id = mentees.id AND
//   mentees.account_id = accounts.id AND
//   match.email_eleven_months_sent = false AND
//   match.email_six_months_sent = true AND
//   match.email_three_months_sent = true AND
//   match.email_one_month_sent = true AND
//   match.mentor_id = mentors.id

//   `;

//   return [...mentors, ...mentees];
// }
// export async function toggleEmailTenMonths(mentorId, menteeId) {
//   await sql`
//   UPDATE match
//   SET email_ten_months_sent = true
//   WHERE match.mentor_id IN (${mentorId}) AND
//   match.mentee_id IN (${menteeId}) AND
//   match.email_one_month_sent = true AND
//   match.email_three_months_sent = true AND
//   match.email_six_months_sent = true
//   `;
// }

// export async function selectUsersForFeedbackEmailElevenMonths() {
//   const mentors = await sql`
//   SELECT mentors.id AS mentor_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentor_id = mentors.id AND
//   mentors.account_id = accounts.id AND
//   match.email_eleven_months_sent = false AND
//   match.email_ten_months_sent = true AND
//   match.email_six_months_sent = true AND
//   match.email_three_months_sent = true AND
//   match.email_one_month_sent = true AND
//   match.mentee_id = mentees.id

//   `;

//   const mentees = await sql`
//   SELECT mentees.id AS mentee_id, accounts.email, accounts.first_name, match.match_timestamp
//   FROM
//   accounts,
//   match,
//   mentors,
//   mentees
//   WHERE
//   match.mentee_id = mentees.id AND
//   mentees.account_id = accounts.id AND
//   match.email_eleven_months_sent = false AND
//   match.email_ten_months_sent = true AND
//   match.email_six_months_sent = true AND
//   match.email_three_months_sent = true AND
//   match.email_one_month_sent = true AND
//   match.mentor_id = mentors.id

//   `;

//   return [...mentors, ...mentees];
// }
// export async function toggleEmailElevenMonths(mentorId, menteeId) {
//   await sql`
//   UPDATE match
//   SET email_eleven_months_sent = true
//   WHERE match.mentor_id IN (${mentorId}) AND
//   match.mentee_id IN (${menteeId}) AND
//   match.email_one_month_sent = true AND
//   match.email_three_months_sent = true AND
//   match.email_six_months_sent = true AND
//   match.email_ten_months_sent = true
//   `;
// }

// export async function getAccIdByMenteeId(menteeId) {
//   const accId = await sql`
//   SELECT accounts.id
//   FROM
//   accounts,
//   mentees
//   WHERE
//   mentees.id = ${menteeId} AND
//   mentees.account_id = accounts.id
//   `;
//   return accId;
// }

// export async function adjustMenteeCapacity(mentorId) {
//   await sql`
//   UPDATE mentors
//   SET mentee_capacity = mentee_capacity - 1
//   WHERE id = ${mentorId}
//   `;
// }
