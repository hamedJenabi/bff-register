import {
  titleCase,
  groupLevelsToShow,
  levelsToShow,
} from "../../utils/functions";

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

export default async function mailall(req, response) {
  const user = req.body;

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
    theme_class: req.body.theme_class,
    competition: req.body.competition,
    competition_role: req.body.competition_role,
    competitions: req.body.competitions,
    lunch: req.body.lunch,
    terms: req.body.terms,
  };

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
  const getTicketLabel = (ticket) => {
    if (ticket === "partyPass") {
      return "Party Pass";
    }
    if (ticket === "fullpass") {
      return "Full Pass";
    }
  };
  const ticket = getTicketLabel(requestData.ticket);

  const msg = {
    from: "registration@bluesfever.eu",
    to: `${user.email}`,
    template_id: "d-faecb94e7a544674883c69bc2421b9ec",
    dynamic_template_data: {
      firstName: `${user.first_name}`,
      lastName: `${user.last_name}`,
      country: `${user.country}`,
      role: `${titleCase(user.role)}`,
      level: `${getLevelLabelForEmail(user.level)}`,
      ticket: `${ticket}`,
      lunch: `${requestData.lunch}`,
      themeClass: `${user.theme_class ? titleCase(user.theme_class) : "No"}`,
      competition:
        user.competition === "yes" || user.competition === "later"
          ? true
          : false,
      competitionAnswer:
        user.competition === "later" ? "I will decide later" : "No",
      competition_role: `${user.competition_role}`,
      competitions: user.competitions
        ? `${user.competitions
            .split(",")
            .map((competition) => titleCase(competition))}`
        : "",
    },
  };
  await sendEmail(msg);
  if (user) {
    response.status(200).json();
  } else {
    response.status(401).json();
  }
}
