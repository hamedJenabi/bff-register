import { titleCase, discounts, levelsToShow } from "../../utils/functions";
import {
  updateUserInfo,
  removeFromWaitingList,
  removeFromCapacity,
  addToWaitingList,
  getTicketByName,
  addToCapacity,
} from "../../db/db";
const getLevelLabelForEmail = (level) => {
  if (level === "") {
    return "";
  }
  if (level !== "") {
    const title = levelsToShow?.find((item) => item.value === level)?.label;
    return titleCase(title);
  }
};
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
//******** Level & Ticket Label *********/
const getLevelLabel = (level) => {
  if (level === "levelOne") {
    return "Level 1";
  }
  if (level === "levelTwo") {
    return "Level 2";
  }
  if (level === "levelThree") {
    return "Level 3";
  }
  if (level === "") {
    return "";
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
export default async function edituser(req, response) {
  const statusList = [
    "registered",
    "email-sent",
    "confirmed",
    "waitinglist",
    "canceled",
  ];
  const time = new Date();
  const date = new Date().toISOString();

  const requestData = {
    status: req.body.status,
    prevStatus: req.body.prevStatus,
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
  const isGroupDiscount = discounts.some(
    ({ email }) => email === req.body.email
  );
  const getPrice = (requestData, isGroupDiscount) => {
    const initialPrice = requestData.ticket === "partyPass" ? 95 : 195;
    const competitions =
      requestData.competition === "yes"
        ? requestData.competitions.split(",")?.length * 10
        : 0;
    const themeClass =
      requestData.themeClass === "no" || requestData.themeClass === "" ? 0 : 40;
    console.log("here", initialPrice, competitions, themeClass);
    const totalPrice = initialPrice + competitions + themeClass;
    const output = isGroupDiscount
      ? Math.round((totalPrice / 100) * 90)
      : totalPrice;
    return output;
  };
  const totalPrice = getPrice(requestData, isGroupDiscount);
  /***** GET PRICE AND LEVEL */
  const level = titleCase(requestData.level);
  const ticket = getTicketLabel(requestData.ticket);
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
  let template = "";
  if (!statusList.includes(req.body.status)) {
    response.status(401).json();
  } else {
    if (req.body.status === "email-sent") {
      if (requestData.prevStatus === "waitinglist") {
        const ticketName =
          requestData.ticket === "partyPass"
            ? requestData.ticket
            : `${requestData.level}_${requestData.role}`;
        const { id: ticketId } = await getTicketByName(ticketName);
        await removeFromWaitingList(ticketId);
        await addToCapacity(ticketId);
      }
      template = "d-eec50fc0f8824f0aa2c66a7196890ed5";
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
            ? `${requestData.competitions
                .split(",")
                .map((competition) => titleCase(competition))}`
            : "",
          terms: `${requestData.terms}`,
          status: `${requestData.status}`,
          isGroupDiscount: isGroupDiscount,
          price: `${totalPrice}`,
        },
      };
      await sendEmail(msg);
    }
    if (req.body.status === "waitinglist") {
      const ticketName =
        requestData.ticket === "partyPass"
          ? requestData.ticket
          : `${requestData.level}_${requestData.role}`;
      const { id: ticketId } = await getTicketByName(ticketName);
      await removeFromCapacity(ticketId);
      await addToWaitingList(ticketId);

      const msg = {
        from: "registration@thebluesjoint.dance",
        to: `${requestData.email}`,
        template_id: "", // waiting list
        dynamic_template_data: {
          firstName: `${requestData.first_name}`,
          lastName: `${requestData.last_name}`,
          country: `${requestData.country}`,
          role: `${requestData.role}`,
          level: `${level}`,
          ticket: `${ticket}`,
          shirt: `${requestData.shirt}`,
          shirtSize: `${requestData.shirtSize}`,
          terms: `${requestData.terms}`,
          status: `${requestData.status}`,
          price: `${totalPrice}`,
        },
      };
      await sendEmail(msg);
    }
    if (req.body.status === "confirmed") {
      const msg = {
        from: "registration@thebluesjoint.dance",
        to: `${requestData.email}`,
        template_id: "d-e92efc2ec0094393a177a7c20d91d8a3",
        dynamic_template_data: {
          firstName: `${requestData.first_name}`,
          lastName: `${requestData.last_name}`,
          country: `${requestData.country}`,
          role: `${requestData.role}`,
          level: `${level}`,
          ticket: `${ticket}`,
          shirt: `${requestData.shirt}`,
          shirtSize: `${requestData.shirtSize}`,
          terms: `${requestData.terms}`,
          status: `${requestData.status}`,
          price: `${totalPrice}`,
        },
      };
      // await sendEmail(msg);
    }
    // and more conditions
    if (req.body.status === "canceled") {
      const ticketName =
        requestData.ticket === "partyPass"
          ? requestData.ticket
          : `${requestData.level}_${requestData.role}`;
      const { id: ticketId } = await getTicketByName(ticketName);
      if (requestData.prevStatus === "waitinglist") {
        await removeFromWaitingList(ticketId);
      } else {
        await removeFromCapacity(ticketId);
      }
    }
    await updateUserInfo(req.body, totalPrice);
    response.status(200).json();
  }
}
