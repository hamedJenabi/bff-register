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

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  if (ticket === "parentPass") {
    return "Parent Pass";
  }
};

//******** prepare GOOGLE SHEET *********/

export default async function register(req, response) {
  const requestData = {
    date: time.toDateString(),
    email: req.body.email.trim().toLowerCase(),
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    country: req.body.country,
    role: req.body.role ?? "",
    ticket: req.body.ticket ?? "",
    parent_partner: req.body.parent_partner ?? "",
    level: req.body.level,
    theme_class: req.body.theme_class,
    competition: req.body.competition,
    open_mixnmatch_role: req.body.open_mixnmatch_role,
    newcomers_mixnmatch_role: req.body.newcomers_mixnmatch_role,
    strictly_role: req.body.strictly_role,
    competitions: req.body.competitions,
    tshirt: req.body.tshirt,
    donation_amount: req.body.donation_amount,
    lunch: req.body.lunch,
    terms: req.body.terms,
  };
  const { session_id } = req.query;

  let ticketName =
    requestData.ticket === "partyPass"
      ? requestData.ticket
      : `${requestData.level}_${requestData.role}`;

  if (ticketName === "solo__") {
    ticketName = "solo_";
  }
  console.log("ticketName", ticketName);
  const session = await stripe.checkout.sessions.retrieve(session_id);
  let user_status = "registered";
  if (session.payment_status === "paid") {
    // update ticket capacity in database
    await updateTicketCapacity(ticketName);
    user_status = "confirmed";
    // add confirmation email template to it,
    // template = ....
  }

  // const { id: ticketId } = await getTicketByName(ticketName);
  // const { capacity } = await isTicketAvailable(ticketId);
  // const { waiting_list } = await isTicketAvailable(ticketId);

  const isGroupDiscount = discounts.some(({ mail }) => mail === req.body.email);
  const totalPrice = getPrice(requestData, isGroupDiscount);
  // console.log("totalPrice", totalPrice);
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
    let user = {
      status: user_status,
      price: totalPrice.toString(),
      ...requestData,
    };
    template = "d-a3d0a3b2f11f4c0d8c9008e9db9fa07d";

    // if (requestData.ticket === "partyPass") {
    //   user = {
    //     status: "email-sent",
    //     price: totalPrice.toString(),
    //     ...requestData,
    //   };
    //   template = "d-eec50fc0f8824f0aa2c66a7196890ed5";
    // }

    const [{ id }] = await insertRegistration(user);

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
      open_mixnmatch_role: `${requestData.open_mixnmatch_role}`,
      newcomers_mixnmatch_role: `${requestData.newcomers_mixnmatch_role}`,
      strictly_role: `${requestData.strictly_role}`,
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
      tshirt: `${
        requestData.tshirt !== "" ? requestData.tshirt : "No T-shirt"
      }`,
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
    await sendEmail(msg);
  }
  // await sendEmail(user.status, msg);
}
