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
    lead: 16,
    follow: 16,
  },
  {
    lead: 20,
    follow: 20,
    label: "Intermediate",
    value: "int",
    detail:
      "You have had local classes and maybe one or more international workshops. You can execute the basic movements and steps. You know some variations of basics and you can choose them depending on the style of music.",
  },
  {
    lead: 20,
    follow: 20,
    label: "Advanced",
    value: "adv",
    detail:
      "You travel internationally to festivals and have attended workshops. You have an expanded vocabulary (aesthetics and movements) and have achieved good musicality. You have a high understanding of partnership in dancing.",
  },
  {
    lead: 20,
    follow: 20,
    label: "Struttin'  (Intermediate/Advanced and above)",
    value: "struttin",
    detail:
      "You consistently demonstrate, describe, and differentiate between a range of styles and movements, while maintaining blues aesthetic. You include some layered movements. You can observe and work out movement execution. You may teach blues at your local scene and do lots of international workshops.",
  },
  {
    lead: 18,
    follow: 18,
    label: "Chicago Triple (Intermediate/Advanced and above)",
    value: "chicago_triple",
    detail:
      "You consistently demonstrate, describe, and differentiate between a range of styles and movements, while maintaining blues aesthetic. You include some layered movements. You can observe and work out movement execution. You may teach blues at your local scene and do lots of international workshops.",
  },
  {
    lead: 18,
    follow: 18,
    label: "Latin Blues (Intermediate/Advanced and above)",
    value: "latin_blues",
  },
  {
    lead: 18,
    follow: 18,
    label: "Stride & Strut - Ballroomin' (Intermediate/Advanced and above)",
    value: "stride_strut",
  },
  {
    lead: 18,
    follow: 18,
    label: "Advanced +",
    value: "adv+",
    detail:
      "You and Blues have a long story together. You end up going to finals in almost every competition, you practice regularly, and may teach Blues not only in your scene but also internationally.",
  },
];

export const finalLevelsToShow = [
  {
    label: "Beginner/Intermediate",
    value: "beg/int",
    detail:
      "You have had one or two blues dance classes and are ready to know more about Blues.",
    lead: 16,
    follow: 16,
  },
  {
    lead: 20,
    follow: 20,
    label: "Intermediate-1",
    value: "int1",
    detail:
      "You have had local classes and maybe one or more international workshops. You can execute the basic movements and steps. You know some variations of basics and you can choose them depending on the style of music.",
  },
  {
    lead: 15,
    follow: 15,
    label: "Intermediate-2",
    value: "int2",
    detail:
      "You have had local classes and maybe one or more international workshops. You can execute the basic movements and steps. You know some variations of basics and you can choose them depending on the style of music.",
  },
  {
    lead: 20,
    follow: 20,
    label: "Struttin'  (Intermediate/Advanced and above)",
    value: "struttin",
    detail:
      "You consistently demonstrate, describe, and differentiate between a range of styles and movements, while maintaining blues aesthetic. You include some layered movements. You can observe and work out movement execution. You may teach blues at your local scene and do lots of international workshops.",
  },
  {
    lead: 18,
    follow: 18,
    label: "Chicago Triple  (Intermediate/Advanced and above)",
    value: "chicago_triple",
    detail:
      "You consistently demonstrate, describe, and differentiate between a range of styles and movements, while maintaining blues aesthetic. You include some layered movements. You can observe and work out movement execution. You may teach blues at your local scene and do lots of international workshops.",
  },
  {
    lead: 18,
    follow: 18,
    label: "Latin Blues  (Intermediate/Advanced and above)",
    value: "latin_blues",
  },
  {
    lead: 18,
    follow: 18,
    label: "Stride & Strut - Ballroomin'  (Intermediate/Advanced and above)",
    value: "stride_strut",
  },
  {
    lead: 18,
    follow: 18,
    label: "Advanced +",
    value: "adv+",
    detail:
      "You and Blues have a long story together. You end up going to finals in almost every competition, you practice regularly, and may teach Blues not only in your scene but also internationally.",
  },
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
let fullpassPriceTemp = 235;
let partyPriceTemp = 135;

if (isAfterTargetDate("2025-08-04T00:12:00+02:00")) {
  fullpassPriceTemp = 245;
}

if (isAfterTargetDate("2025-09-15T00:01:00+02:00")) {
  fullpassPriceTemp = 255;
}

if (isAfterTargetDate("2024-09-15T00:01:00+02:00")) {
  partyPriceTemp = 145;
}

// export const fullpassPrice = isAfterTargetDate("2024-09-15T00:01:00+02:00")
//   ? 255
//   : 235;
// export const partyPrice = isAfterTargetDate("2024-09-15T00:01:00+02:00")
//   ? 145
//   : 135;
export const fullpassPrice = fullpassPriceTemp;
export const partyPrice = partyPriceTemp;

export const getPrice = (requestData, isGroupDiscount) => {
  const initialPrice =
    requestData.ticket === "partyPass" || requestData.ticket === "parentPass"
      ? partyPrice
      : fullpassPrice;
  console.log("initialPrice", isGroupDiscount);
  const ticketPrice = isGroupDiscount
    ? Math.round((initialPrice / 100) * 90)
    : initialPrice;

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
  const tshirtPrice = requestData.tshirt.length > 0 ? 25 : 0;
  const lunchMoney = requestData.lunch?.length * 15 || 0;

  const totalPrice =
    ticketPrice +
    donationAmount +
    tshirtPrice +
    competitions +
    theme_class +
    lunchMoney +
    fullPassdiscount;

  return totalPrice;
};

export const discounts = [
  { mail: "hamed.jenabi@gmail.com" },
  { mail: "me@woutervervloet.com" },
  { mail: "anicebo22@gmail.com" },
  { mail: "dijkstra.lel@gmail.com" },
  { mail: "nekotanik@gmail.com" },
  { mail: "vicky.broos@gmail.com" },
  { mail: "collinvandenbroek@gmail.com" },
  { mail: "asnytin@gmail.com" },
  { mail: "beauvandergiessen@gmail.com" },
  { mail: "r.j.bongers@gmail.com" },
  { mail: "snezana.otas@gmail.com" },
  { mail: "jjbarreno@gmail.com" },
  { mail: "victor_roosjr@hotmail.com" },
  { mail: "daria@yurieva.ru" },
  { mail: "elsa.filippidou@gmail.com" },
  { mail: "aayang444@gmail.com" },
  { mail: "edward.curran@hotmail.co.uk" },
  { mail: "krhuang5@gmail.com" },
  { mail: "mxeinhorn@gmail.com" },
  { mail: "qianita.sun@gmail.com" },
  { mail: "sampsondsyuan@gmail.com" },
  { mail: "yjkberlin@rawdata.space" },
  { mail: "izemylmaz@gmail.com" },
  { mail: "rundmails@AndreasMerkert.de" },
  { mail: "mykolamalik@gmail.com" },
  { mail: "yasmin@bluesfever.eu" },
  { mail: "panayotova.vasilena@gmail.com" },
  { mail: "nedahristova16@gmail.com" },
  { mail: "desidesign1996@gmail.com" },
  { mail: "gamanolova@gmail.com" },
  { mail: "sirakova@greenlife.bg" },
  { mail: "agodinova@gmail.com" },
  { mail: "daniela.i.ranova@gmail.com" },
  { mail: "angelov.pavel@gmail.com" },
  { mail: "margarita.baykova@gmail.com" },
  { mail: "kdentchev@mail.bg" },
  { mail: "pavel966969@gmail.com" },
  { mail: "a_lozev1962@abv.bg" },
  { mail: "onopko@abv.bg" },
];

export const isGroupDiscount = (email) =>
  discounts.some(({ mail }) => mail === email);

export function isAfterTargetDate(d) {
  // Specify the target date and time (3rd August 2023, 18:00 CET)
  const targetDate = new Date(d);

  // Get the current date and time
  const currentDate = new Date();

  // Compare the current date with the target date
  return currentDate > targetDate;
}
