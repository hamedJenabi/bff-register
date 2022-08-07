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

/**** GOOGLE SHEET STUFF ******/

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const SHEET_ID = process.env.REACT_APP_SHEET_ID;
const CLIENT_EMAIL = process.env.REACT_APP_GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.REACT_APP_GOOGLE_SERVICE_PRIVATE_KEY;
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

const updateGoogle = async (user) => {
  const date = new Date().toISOString();
  const inputForGoogleSheet = {
    status: user.status,
    register_date: date,
    email: user.email,
    First_Name: user.first_name,
    Last_Name: user.last_name,
    country: user.country,
    ticket: user.ticket,
    role: user.role,
    level: user.level,
    price: user.price,
    themeClass: user.themeClass,
    competition_role: user.competition_role,
    competitions: user.competitions?.toString(),
  };
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
  try {
    await doc.useServiceAccountAuth({
      client_email: CLIENT_EMAIL,
      private_key:
        PRIVATE_KEY === undefined
          ? console.log("error")
          : PRIVATE_KEY.replace(/\\n/gm, "\n"),
    });
    await doc.loadInfo();
    const sheet = doc.sheetsById[SHEET_ID];
    const result = await sheet.addRow(inputForGoogleSheet);
  } catch (e) {
    console.error("Error: ", e);
  }
};

export default async function register(req, response) {
  const requestData = {
    date: time.toDateString(),
    email: req.body.email,
    first_name: req.body.firstName,
    last_name: req.body.lastName,
    country: req.body.country,
    role: req.body.role ?? "",
    ticket: req.body.ticket ?? "",
    level: req.body.level,
    themeClass: req.body.themeClass,
    competition: req.body.competition,
    competition_role: req.body.competition_role,
    competitions: req.body.competitions,
    terms: req.body.terms,
  };
  const ticketName =
    requestData.ticket === "partyPass"
      ? requestData.ticket
      : `${requestData.level}_${requestData.role}`;
  const { id: ticketId } = await getTicketByName(ticketName);
  const { capacity } = await isTicketAvailable(ticketId);
  const { waiting_list } = await isTicketAvailable(ticketId);

  const isGroupDiscount = discounts.some(
    ({ email }) => email === req.body.email
  );
  console.log("isGroupDiscount", isGroupDiscount);
  const totalPrice = getPrice(requestData, isGroupDiscount);

  ///////   TODO: GET TOTAL PRICE ///////
  const level = getLevelLabel(requestData.level);
  const ticket = getTicketLabel(requestData.ticket);
  const userswithSameEmail = await getUserByEmailAndName(requestData.email);
  let isAlreadyRegistered = false;
  if (userswithSameEmail) {
    isAlreadyRegistered =
      userswithSameEmail.email + userswithSameEmail.first_name ===
      requestData.email + requestData.first_name;
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
    await updateGoogle(user);

    response.status(200).json();
    // send registration email
  }

  if (capacity <= 0 && !isAlreadyRegistered) {
    // 200 -> registered
    // 300 -> waiting list
    // 301 -> sold out
    if (waiting_list > 0) {
      await updateTicketWaiting(ticketId);
      const user = {
        status: "waitinglist",
        price: totalPrice.toString(),
        ...requestData,
      };
      template = "d-52a8e8e3cff741c583127915ee291c39";
      const [{ id }] = await insertRegistration(user);
      // const userWithId = {
      //   id,
      //   status: "waitinglist",
      //   requestData,
      // };
      // await updateUserInfo(userWithId);
      await updateGoogle(user);
      response.status(300).json();

      // waiting list email
    }
    if (waiting_list <= 0 && !isAlreadyRegistered) {
      isSoldOut = true;
      // send sold out email
      response.status(301).json();
    }
  }
  const msg = {
    from: "registration@bluesfever.eu",
    to: `${requestData.email}`,
    template_id: template,
    dynamic_template_data: {
      firstName: `${requestData.first_name}`,
      lastName: `${requestData.last_name}`,
      country: `${requestData.country}`,
      role: `${titleCase(requestData.role)}`,
      level: `${getLevelLabelForEmail(requestData.level)}`,
      ticket: `${ticket}`,
      themeClass: `${titleCase(requestData.themeClass)}`,
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
