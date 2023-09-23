import {
  titleCase,
  discounts,
  newDiscount,
  levelsToShow,
  groupLevelsToShow,
  getPrice,
} from "../../utils/functions";
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
    const groupTitle = groupLevelsToShow?.find(
      (item) => item.value === level
    )?.label;
    return titleCase(title) ? titleCase(title) : titleCase(groupTitle);
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
  if (ticket === "parentPass") {
    return "Parent Pass";
  }
};
export default async function edituser(req, response) {
  const statusList = [
    "registered",
    "reminder",
    "email-sent",
    "confirmed",
    "waitinglist",
    "canceled",
    "out",
  ];
  const isEditing = req.query?.action === "edit";

  const time = new Date();
  const date = new Date().toISOString();

  const requestData = {
    status: req.body.status,
    prevStatus: req.body.prevStatus,
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
    lunch: req.body.lunch,
    donation_amount: req.body.donation,
    terms: req.body.terms,
    isGroupApi: req.body.isGroupApi,
    price: req.body.price,
  };
  // constx isGroupDiscount = discounts.some(
  //   ({ email }) => email === req.body.email
  // );
  const isGroupDiscount = newDiscount.some(
    ({ email }) =>
      email.trim().toLowerCase() === req.body.email.trim().toLowerCase()
  );

  // const getPrice = (requestData, isGroupDiscount) => {
  //   const initialPrice = requestData.ticket === "partyPass" ? 110 : 225;
  //   const competitions =
  //     requestData.competition === "yes"
  //       ? requestData.competitions.split(",")?.length * 10
  //       : 0;
  //   const theme_class =
  //     requestData.theme_class === "no" || requestData.theme_class === ""
  //       ? 0
  //       : 40;
  //   const fullPassdiscount =
  //     requestData.ticket === "fullpass" &&
  //     requestData.competition === "yes" &&
  //     requestData.competitions?.length > 0
  //       ? -10
  //       : 0;
  //   const totalPrice =
  //     initialPrice + competitions + theme_class + fullPassdiscount;
  //   const output = isGroupDiscount
  //     ? Math.round((totalPrice / 100) * 90)
  //     : totalPrice;
  //   return output;
  // };
  const newPrice =
    req.body.status === "email-sent" && isGroupDiscount
      ? Math.round((requestData.price / 100) * 90)
      : requestData.price;
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
      // if (requestData.prevStatus === "waitinglist") {
      //   const ticketName =
      //     requestData.ticket === "partyPass"
      //       ? requestData.ticket
      //       : `${requestData.level}_${requestData.role}`;
      //   const { id: ticketId } = await getTicketByName(ticketName);
      //   await removeFromWaitingList(ticketId);
      //   await addToCapacity(ticketId);
      // }
      template = "d-eec50fc0f8824f0aa2c66a7196890ed5";
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
            ? `${requestData.competitions
                .split(",")
                .map((competition) => titleCase(competition))}`
            : "",
          terms: `${requestData.terms}`,
          status: `${requestData.status}`,
          isGroupDiscount: isGroupDiscount,
          price: `${newPrice}`,
          donation: `${requestData.donation_amount}`,
          lunch: `${requestData.lunch}`,
        },
      };
      if (!requestData.isGroupApi && !isEditing) {
        console.log("email SENTSS");
        await sendEmail(msg);
      }
    }
    if (req.body.status === "reminder") {
      template = "d-ffa39fe3a7e440ed94d71fac0170f3af";
      const msg = {
        from: "registration@bluesfever.eu",
        to: `${requestData.email}`,
        template_id: template,
        dynamic_template_data: {
          firstname: `${requestData.firstname}`,
          lastname: `${requestData.lastname}`,
          date: `${requestData.date}`,
          country: `${requestData.country}`,
          role: `${titleCase(requestData.role)}`,
          level: `${getLevelLabelForEmail(requestData.level)}`,
          ticket: `${ticket}`,
          parent_partner: `${requestData.parent_partner}`,
          themeClass: `- ${titleCase(requestData.theme_class)}`,
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
          price: `${newPrice}`,
          donation: `${requestData.donation_amount}`,
          lunch: `${requestData.lunch}`,
        },
      };
      if (!requestData.isGroupApi && !isEditing) {
        console.log("email SENTSS");
        await sendEmail(msg);
      }
    }
    if (req.body.status === "waitinglist") {
      const msg = {
        from: "registration@bluesfever.eu",
        to: `${requestData.email}`,
        template_id: "d-47f29cd18c134b89bf5496573737abdc",
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
            ? `${requestData.competitions
                .split(",")
                .map((competition) => titleCase(competition))}`
            : "",
          terms: `${requestData.terms}`,
          status: `${requestData.status}`,
          isGroupDiscount: isGroupDiscount,
          price: `${newPrice}`,
          donation: `${requestData.donation_amount}`,
          lunch: `${requestData.lunch}`,
        },
      };
      if (!requestData.isGroupApi && !isEditing) {
        console.log("email SENTSS");
        await sendEmail(msg);
      }
    }
    if (req.body.status === "confirmed") {
      const msg = {
        from: "registration@bluesfever.eu",
        to: `${requestData.email}`,
        template_id: "d-9a1d3b06c6fb43f69a1ee68b940ebe35",
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
            ? `${requestData.competitions
                .split(",")
                .map((competition) => titleCase(competition))}`
            : "",
          terms: `${requestData.terms}`,
          status: `${requestData.status}`,
          isGroupDiscount: isGroupDiscount,
          price: `${newPrice}`,
          donation: `${requestData.donation_amount}`,
          lunch: `${requestData.lunch}`,
        },
      };
      if (!requestData.isGroupApi && !isEditing) {
        console.log("email SENTSS");
        await sendEmail(msg);
      }
    }
    // and more conditions
    if (req.body.status === "out") {
      const msg = {
        from: "registration@bluesfever.eu",
        to: `${requestData.email}`,
        template_id: "d-792c656cb1a14df6987d0b6867f5295b",
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
            ? `${requestData.competitions
                .split(",")
                .map((competition) => titleCase(competition))}`
            : "",
          terms: `${requestData.terms}`,
          status: `${requestData.status}`,
          isGroupDiscount: isGroupDiscount,
          price: `${newPrice}`,
          donation: `${requestData.donation_amount}`,
          lunch: `${requestData.lunch}`,
          donation: `${requestData.donation_amount}`,
          lunch: `${requestData.lunch}`,
        },
      };
      if (!requestData.isGroupApi && !isEditing) {
        console.log("email senttt");
        await sendEmail(msg);
      }
    }
    if (req.body.status === "cancelled") {
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
    await updateUserInfo(req.body, newPrice);
    response.status(200).json();
  }
}
