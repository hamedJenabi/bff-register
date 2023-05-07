export const titleCase = (s) =>
  s?.replace(/^_*(.)|_+(.)/g, (s, c, d) =>
    c ? c.toUpperCase() : " " + d.toUpperCase()
  );

export const levelsToShow = [
  {
    label: "Beginner/Intermediate",
    value: "beg/int",
    detail:
      "You have had one or two blues dance classes and are ready to know more about Blues.",
  },
  {
    label: "Intermediate",
    value: "int",
    detail:
      "You have had local classes and maybe one or more international workshops. You can execute the basic movements and steps. You know some variations of basics and you can choose them depending on the style of music.",
  },
  {
    label: "Intermediate/Advanced",
    value: "int/adv",
    detail:
      "You travel internationally to festivals and attended workshops. You have an expanded vocabulary (aesthetic and movements) and have achieved a good musicality. You have a high understanding of partnership in dancing.",
  },
  {
    label: "Advanced",
    value: "adv",
    detail:
      "You consistently demonstrate, describe, and differentiate between a range of styles and movements, while maintaining blues aesthetic. You include some layered movements. You can observe and work out movement execution. You may teach blues at your local scene and do lots of international workshops.",
  },
  // {
  //   label: "Saxophone - Advanced+",
  //   value: "saxophone",
  //   detail:
  //     "You and Blues have a long story together. You end up going to finals in almost every competition, you practice regularly, and may teach Blues not only in your scene but also internationally.",
  // },
];
export const groupLevelsToShow = [
  {
    label: "Piano",
    value: "piano",
  },
  {
    label: "Guitar",
    value: "guitar",
  },
  {
    label: "Trumpet(1)",
    value: "trumpet1",
  },
  {
    label: "Trumpet(2)",
    value: "trumpet2",
  },
  {
    label: "Drums(1)",
    value: "drums1",
  },
  {
    label: "Drums(2)",
    value: "drums2",
  },
  {
    label: "Saxophone",
    value: "saxophone",
  },
];
export const compettionsInfo = [
  {
    label: "Solo Battle",
    value: "solo_battle",
    detail:
      "In the absolute beginners track you do not need any dancing experience. If you already dance a partner dance like Lindy Hop or Tango, it will be easier, but we start from scratch. We offer 5 hours of classes in a small group (max 20) by professional international teachers. There is no better way to start your Blues dancing career.",
  },
  {
    label: "Open MixMatch",
    value: "open_mixnmatch",
    detail:
      "The beginner - intermediate track will assume you already master you Blues basics. You are dancing Blues for about 6 to 12 months. You had weekly classes and joined several socials. You want to improve your technique and vocabulary and be more comfortable in leading & following.",
  },
  {
    label: "Newcomers MixMatch",
    value: "newcomers_mixnmatch",
    detail:
      "So you think you can dance? As an intermediate we expect you to master your fundamental skills and be comfortable in dancing on different Blues styles. You can improvise based on the music and have no trouble with slow or faster rhythms. You already dance one or two years on a frequent base.",
  },
  {
    label: "Strictly",
    value: "strictly",
    detail:
      "This level is for those who have been dancing Blues since birth, or at least three years. You have attended many international workshops and maybe even teaching in your local scene. Done competitions and reached the final now and then. There will be no audition but we don’t spare you in this level, so please don’t misjudge your ability, for your sake and for your class mates.",
  },
  {
    label: "Fever Showcase",
    value: "fever_showcase",
    detail:
      "This level is for those who have been dancing Blues since birth, or at least three years. You have attended many international workshops and maybe even teaching in your local scene. Done competitions and reached the final now and then. There will be no audition but we don’t spare you in this level, so please don’t misjudge your ability, for your sake and for your class mates.",
  },
];

export const getPrice = (requestData, isGroupDiscount) => {
  const initialPrice = requestData.ticket === "partyPass" ? 115 : 225;
  const competitions =
    requestData.competition === "yes"
      ? requestData.competitions?.length * 10
      : 0;
  const theme_class =
    requestData.theme_class === "no" || requestData.theme_class === "" ? 0 : 45;
  const fullPassdiscount =
    requestData.ticket === "fullpass" &&
    requestData.competition === "yes" &&
    requestData.competitions?.length > 0
      ? -10
      : 0;
  const donationAmount = requestData.donation_amount
    ? parseInt(requestData.donation_amount)
    : 0;

  console.log("donationAmount", donationAmount);
  const lunchMoney = requestData.lunch?.length * 12.5 || 0;
  const totalPrice =
    initialPrice +
    donationAmount +
    competitions +
    theme_class +
    lunchMoney +
    fullPassdiscount;
  const output = isGroupDiscount
    ? Math.round((totalPrice / 100) * 90)
    : totalPrice;
  console.log("priceee", output);
  return output;
};

export const discounts = [
  { name: "test", email: "hamed.jenabi@gmail.com" },
  //   { name: "Isabelle Mugai", email: "imugai7@gmail.com" },
  //   { name: "Shivani Govender", email: "shivani.govender@gmail.com" },
  //   { name: "Richard Challans", email: "rchallans@gmail.com" },
  //   { name: "Melanie Hargraves", email: "melennium88@hotmail.com" },
  //   { name: "Zoë Enstone", email: "zoe.enstone@gmail.com" },
  //   { name: "Dalvinder Kular ", email: "dalvinder_kular@hotmail.com" },
  //   { name: "Chris Kearns", email: "chris.kearns32@gmail.com" },
  //   { name: "Kiran Randhawa Kukar", email: "kiranrkukar@gmail.com" },
  //   { name: "Henry Whitfield ", email: "henry@presentmind.org" },
  //   { name: "Lola Michels", email: "lola.michels@icloud.com" },
  //   { name: "Stephen Atemie", email: "dsatemie@gmail.com" },
  //   { name: "Sarah Stein Lubrano", email: "hei.eleanor.L@gmail.com" },
  //   { name: "Eleanor Lin", email: "hei.eleanor.L@gmail.com" },
  //   { name: "Lena Drotleff", email: "katzengoldsound@gmail.com" },
  //   { name: "Richard", email: "richardvanos@gmail.com" },
  //   { name: "Yvet", email: "yvetdiamanti@gmail.com" },
  //   { name: "Ineke", email: "Ineke.vanderhurk@gmail.com" },
  //   { name: "renske", email: "r.j.bongers@gmail.com" },
  //   { name: "wouter", email: "me@woutervervloet.com" },
  //   { name: "Maja", email: "majcor@gmail.com" },
  //   { name: "Lotte", email: "Dijkstra.lel@gmail.com" },
  //   { name: "Karolina Ufa", email: "karolinaufa@op.pl" },
  //   { name: "Radosław Kita", email: "kita.radoslaw@gmail.com" },
  //   { name: "Sylwia Mazanek", email: "sylwia-mazanek@wp.pl" },
  //   { name: "Katarzyna Kośka", email: "Kaskakoska@vp.pl" },
  //   { name: "Jacek Turula", email: "jaturul@gmail.com" },
  //   { name: "Alicja Broda", email: "abrodaa@gmail.com" },
  //   { name: "Marta Maria Świetlik", email: "martamariaklara@gmail.com" },
  //   { name: "Tomasz Błaszczyk", email: "tombla7@gmail.com" },
  //   { name: "Katarzyna Kamińska", email: "wojniak@gmail.com" },
  //   { name: "Mateusz Kamiński", email: "kaminski569@gmail.com" },
  //   { name: "Paweł Kruszyna", email: "jolbulek@gmail.com" },
  //   { name: "Piotr Cygoń", email: "cygon@gmail.com" },
  //   { name: "Ilya Idamkin", email: "ilya.idamkin@gmail.com" },
  //   { name: "name", email: "anastasiageorgiou80@hotmail.com" },
  //   { name: "name", email: "carlo.nigra1981@gmail.com" },
  //   { name: "name", email: "fr.ronco@gmail.com" },
  //   { name: "name", email: "ilbrucato@gmail.com" },
  //   { name: "name", email: "luisa.gnavi@gmail.com" },
  //   { name: "name", email: "sarahnicolucci@hotmail.com" },
  //   { name: "name", email: "giuliacomello@gmail.com" },
  //   { name: "name", email: "fab.caselli@gmail.com" },
  //   { name: "name", email: "ccravero0@gmail.com" },
  //   { name: "name", email: "lorypas80@gmail.com" },
  //   { name: "name", email: "gianlucaferraradoc@gmail.com" },
  //   { name: "name", email: "giraffastrisce@gmail.com" },
  //   { name: "name", email: "korec.tomas@gmail.com" },
  //   { name: "name", email: "solcova.hedvika@gmail.com" },
  //   { name: "name", email: "adamthecamper@gmail.com" },
  //   { name: "name", email: "sona.valuchova@gmail.com" },
  //   { name: "name", email: "andrea.jannova@centrum.cz" },
  //   { name: "name", email: "vaclav.strnad@seznam.cz" },
  //   { name: "name", email: "monika.maksimowicz@gmail.com" },
  //   { name: "name", email: "lukybara@gmail.com" },
  //   { name: "name", email: "kamila.musilova@gmail.com" },
  //   { name: "name", email: "kubo.novak@gmail.com" },
  //   { name: "name", email: "evca.neduchalova@centrum.cz" },
  //   { name: "name", email: "pavla.adamcikova@gmail.com" },
  //   { name: "name", email: "monikawikarska@gmail.com" },
  //   { name: "name", email: "natalia.vodislavska@gmail.com" },
  //   { name: "name", email: "janacova.veronika@gmail.com" },
  //   { name: "name", email: "zuzka.lapsanska@gmail.com" },
  //   { name: "name", email: "foto@martinsandera.com" },
  //   { name: "name", email: "andulka9@seznam.cz" },
  //   { name: "name", email: "levenskunstenaar@kpnmail.nl" },
  //   { name: "name", email: "yoeri.kwak@gmail.com" },
  //   { name: "name", email: "giova_naranja@hotmail.com" },
  //   { name: "name", email: "julia@conemans.com" },
  //   { name: "Ugnė Žilinskė", email: "petrauskaite.ugne@gmail.com" },
  //   { name: "Vaiva Gudaitytė", email: "vaiva.gudaityte.liepa@gmail.com" },
  //   { name: "Inesa Plaksij", email: "inesa.plaksij@gmail.com" },
  //   { name: "Arūnas Liškūnas", email: "arunas.liskunas@gmail.com" },
];

export const isGroupDiscount = (email) =>
  discounts.some(({ mail }) => mail === email);
