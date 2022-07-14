import { titleCase, getPrice } from "../../utils/functions";
import { before } from "../../utils/before";
import {
  updateUserInfo,
  removeFromWaitingList,
  removeFromCapacity,
  addToWaitingList,
  getTicketByName,
  addToCapacity,
} from "../../db/db";

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
    return "Main Pass";
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
  const requestData = {
    status: req.body.status,
    prevStatus: req.body.prevStatus,
    email: req.body.email,
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    country: req.body.country,
    role: req.body.role ?? "",
    ticket: req.body.ticket ?? "",
    level: req.body.level,
    volunteer: req.body.volunteer,
    thursday: req.body.thursday,
    exchange: req.body.exchange,
    isEarlyBird: req.body.isEarlyBird,
    shirt: req.body.shirt,
    shirtSize: req.body.shirt_size,
    donation: req.body.donation,
    facts: req.body.facts,
    song: req.body.song,
    terms: true,
  };

  const getEarlyBird = () => {
    if (before.some((user) => user.Email === requestData.email)) {
      const paidBefore = before.find(
        (user) => user.Email === requestData.email
      );
      return { saldo: paidBefore.Saldo, isEarlyBord: true };
    }
    return { saldo: 0, isEarlyBord: false };
  };
  const { saldo } = getEarlyBird();
  const { isEarlyBird } = getEarlyBird();

  const totalPrice = getPrice(requestData, saldo, isEarlyBird);
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
      const msg = {
        from: "registration@thebluesjoint.dance",
        to: `${requestData.email}`,
        template_id: "d-537f34eefd3f4d7fb5b62455fcb976f1",
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
        template_id: "d-52a8e8e3cff741c583127915ee291c39",
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
      await sendEmail(msg);
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
    await updateUserInfo(req.body);
    response.status(200).json();
  }
}
