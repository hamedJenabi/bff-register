import { GoogleSpreadsheet } from "google-spreadsheet";
import {
  insertRegistration,
  getTicketByName,
  updateTicketCapacity,
  updateTicketWaiting,
  isTicketAvailable,
  getUserByEmailAndName,
  updateUserInfo,
  // removeRegistration,
} from "../../db/db";
import {
  titleCase,
  getPrice,
  levelsToShow,
  discounts,
} from "../../utils/functions";

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const time = new Date();

//******** Send Email *********/
const sendEmail = async (msg) => {
  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent");
    })
    .catch((error) => {
      console.error(error);
    });
};
//******** Level & Ticket Label *********/
const getLevelLabel = (level) => {
  if (level === "") {
    return "";
  }
  if (level !== "") {
    return titleCase(level);
  }
};
const getLevelLabelForEmail = (level) => {
  if (level === "") {
    return "";
  }
  if (level !== "") {
    const title = levelsToShow?.find((item) => item.value === level)?.label;
    return titleCase(title);
  }
};

const getTicketLabel = (ticket) => {
  if (ticket === "partyPass") {
    return "Party Pass";
  }
  if (ticket === "fullpass") {
    return "Full Pass";
  }
};

//******** prepare GOOGLE SHEET *********/

export default async function register(req, response) {
  const requestData = {
    date: time.toDateString(),
    email: req.body.email,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    country: req.body.country,
    role: req.body.role ?? "",
    ticket: req.body.ticket ?? "",
    parent_partner: req.body.parent_partner ?? "",
    level: req.body.level,
    theme_class: req.body.theme_class,
    competition: req.body.competition,
    competition_role: req.body.competition_role,
    competitions: req.body.competitions,
    donation_amount: req.body.donation_amount,
    lunch: req.body.lunch,
    terms: req.body.terms,
  };

  const ticketName =
    requestData.ticket === "partyPass"
      ? requestData.ticket
      : `${requestData.level}_${requestData.role}`;
  console.log("ticketName", ticketName);
  // const { id: ticketId } = await getTicketByName(ticketName);
  // const { capacity } = await isTicketAvailable(ticketId);
  // const { waiting_list } = await isTicketAvailable(ticketId);

  const isGroupDiscount = discounts.some(
    ({ email }) => email === req.body.email
  );
  const totalPrice = getPrice(requestData, isGroupDiscount);

  ///////   TODO: GET TOTAL PRICE ///////
  const level = getLevelLabel(requestData.level);
  const ticket = getTicketLabel(requestData.ticket);
  const userswithSameEmail = await getUserByEmailAndName(requestData.email);
  let isAlreadyRegistered = false;
  if (userswithSameEmail) {
    isAlreadyRegistered =
      userswithSameEmail.email + userswithSameEmail.firstname ===
      requestData.email + requestData.firstname;
  }
  let template = "";
  let isSoldOut = false;
  //******** Check Capacity ********/
  if (isAlreadyRegistered) {
    // 302 -> already registered
    response.status(302).json();
  }

  if (!isAlreadyRegistered) {
    // await updateTicketCapacity(ticketId); TODO - update capacity??
    const user = {
      status: "registered",
      price: totalPrice.toString(),
      ...requestData,
    };

    const [{ id }] = await insertRegistration(user);
    template = "d-a3d0a3b2f11f4c0d8c9008e9db9fa07d";
    // await updateGoogle(user);

    response.status(200).json();
    // send registration email
  }

  // if (capacity <= 0 && !isAlreadyRegistered) {
  //   // 200 -> registered
  //   // 300 -> waiting list
  //   // 301 -> sold out
  //   if (waiting_list > 0) {
  //     await updateTicketWaiting(ticketId);
  //     const user = {
  //       status: "waitinglist",
  //       price: totalPrice.toString(),
  //       ...requestData,
  //     };
  //     template = "d-52a8e8e3cff741c583127915ee291c39";
  //     const [{ id }] = await insertRegistration(user);
  //     // const userWithId = {
  //     //   id,
  //     //   status: "waitinglist",
  //     //   requestData,
  //     // };
  //     // await updateUserInfo(userWithId);
  //     // await updateGoogle(user);
  //     response.status(300).json();

  //     // waiting list email
  //   }
  //   if (waiting_list <= 0 && !isAlreadyRegistered) {
  //     isSoldOut = true;
  //     // send sold out email
  //     response.status(301).json();
  //   }
  // }
  const msg = {
    from: "registration@bluesfever.eu",
    to: `${requestData.email}`,
    template_id: template,
    dynamic_template_data: {
      firstname: `${requestData.firstname}`,
      lastname: `${requestData.lastname}`,
      country: `${requestData.country}`,
      role: `${titleCase(requestData.role)}`,
      level: `${getLevelLabelForEmail(requestData.level)}`,
      ticket: `${ticket}`,
      parent_partner: `${requestData.parent_partner}`,
      themeClass: `${titleCase(requestData.theme_class)}`,
      competition: requestData.competition === "yes" ? true : false,
      competitionAnswer:
        requestData.competition === "later" ? "I will decide later" : "No",
      competition_role: `${requestData.competition_role}`,
      competitions: requestData.competitions
        ? `${requestData.competitions.map((competition) =>
            titleCase(competition)
          )}`
        : "",
      terms: `${requestData.terms}`,
      status: `${requestData.status}`,
      isGroupDiscount: isGroupDiscount,
      price: `${totalPrice}`,
      donation: `${requestData.donation_amount}`,
      lunch: `${requestData.lunch}`,
    },
  };
  // const generageMessage = () => {
  //   if (user.status === "registered") {
  //     return "message";
  //   }
  //   if (user.status === "waiting_list") {
  //     return "message";
  //   }
  // };
  if (!isSoldOut) {
    // await sendEmail(msg);
  }
  // await sendEmail(user.status, msg);
}
