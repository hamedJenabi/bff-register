export const titleCase = (s) =>
  s.replace(/^_*(.)|_+(.)/g, (s, c, d) =>
    c ? c.toUpperCase() : " " + d.toUpperCase()
  );

export const levelsToShow = [
  {
    label: "Piano - Beginner/Intermediate",
    value: "piano",
    detail:
      "You have had one or two blues dance classes and are ready to know more about Blues.",
  },
  {
    label: "Guitar - Intermediate",
    value: "guitar",
    detail:
      "You have had local classes and maybe one or more international workshops. You can execute the basic movements and steps. You know some variations of basics and you can choose them depending on the style of music.",
  },
  {
    label: "Trumpet - Intermediate/Advanced",
    value: "trumpet",
    detail:
      "You travel internationally to festivals and attended workshops. You have an expanded vocabulary (aesthetic and movements) and have achieved a good musicality. You have a high understanding of partnership in dancing.",
  },
  {
    label: "Drums - Advanced",
    value: "drums",
    detail:
      "You consistently demonstrate, describe, and differentiate between a range of styles and movements, while maintaining blues aesthetic. You include some layered movements. You can observe and work out movement execution. You may teach blues at your local scene and do lots of international workshops.",
  },
  {
    label: "Saxophone - Advanced+",
    value: "saxophone",
    detail:
      "You and Blues have a long story together. You end up going to finals in almost every competition, you practice regularly, and may teach Blues not only in your scene but also internationally.",
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
  const initialPrice = requestData.ticket === "partyPass" ? 95 : 195;
  const competitions =
    requestData.competition === "yes"
      ? requestData.competitions?.length * 10
      : 0;
  const themeClass =
    requestData.themeClass === "no" || requestData.themeClass === "" ? 0 : 40;
  const totalPrice = initialPrice + competitions + themeClass;
  const output = isGroupDiscount
    ? Math.round((totalPrice / 100) * 90)
    : totalPrice;
  return output;
};

export const discounts = [
  { name: "Isabelle Mugai", email: "imugai7@gmail.com" },
  { name: "Shivani Govender", email: "shivani.govender@gmail.com" },
  { name: "Richard Challans", email: "rchallans@gmail.com" },
  { name: "Melanie Hargraves", email: "melennium88@hotmail.com" },
  { name: "Zoë Enstone", email: "zoe.enstone@gmail.com" },
  { name: "Dalvinder Kular ", email: "dalvinder_kular@hotmail.com" },
  { name: "Chris Kearns", email: "chris.kearns32@gmail.com" },
  { name: "Kiran Randhawa Kukar", email: "kiranrkukar@gmail.com" },
  { name: "Henry Whitfield ", email: "henry@presentmind.org " },
  { name: "Lola Michels", email: "lola.michels@icloud.com" },
  { name: "Stephen Atemie", email: "dsatemie@gmail.com" },
  { name: "Sarah Stein Lubrano", email: "hei.eleanor.L@gmail.com" },
  { name: "Eleanor Lin", email: "hei.eleanor.L@gmail.com" },
  { name: "Lena Drotleff", email: "katzengoldsound@gmail.com" },
];
