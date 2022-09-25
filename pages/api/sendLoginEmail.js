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

export default async function sendLoginEmail(req, response) {
  const user = req.body;
  console.log("user", user);

  const msg = {
    from: "registration@bluesfever.eu",
    to: `${user.email}`,
    template_id: "",
    dynamic_template_data: {
      firstName: `${user.first_name}`,
      lastName: `${user.last_name}`,
      country: `${user.country}`,
      role: `${titleCase(user.role)}`,
      level: `${getLevelLabelForEmail(user.level)}`,
      ticket: `${ticket}`,
      themeClass: `${titleCase(user.theme_class)}`,
      competition: user.competition === "yes" ? true : false,
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
  //   if (user) {
  //     response.status(200).json();
  //   } else {
  //     response.status(401).json();
  //   }
}
