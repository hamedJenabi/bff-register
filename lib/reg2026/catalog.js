export const CATALOG_VERSION = "2026-draft-1";

const placeholderDescription =
  "Class description coming soon. The teaching team will review this information before registration opens.";

const session = (
  id,
  day,
  start,
  end,
  room,
  title,
  teachers,
  partnerClass,
) => ({
  id,
  day,
  start,
  end,
  slotId: `${day.toLowerCase()}-${start.replace(":", "")}`,
  room,
  title: title || `Class with ${teachers} — title coming soon`,
  teachers,
  description: placeholderDescription,
  partnerClass,
});

export const schedule = [
  session("fri-1330-ankersaal", "Friday", "13:30", "14:45", "Ankersaal", "Groove in Motion 1", "Catherine", false),
  session("fri-1330-kantine", "Friday", "13:30", "14:45", "Kantine", "Piedmont Track 1", "Bibi & Dara", true),
  session("fri-1330-studio", "Friday", "13:30", "14:45", "Studio", "", "Dexter", false),
  session("fri-1330-lot", "Friday", "13:30", "14:45", "LOT", "Struttin' Track", "Alex & Ioanna", true),
  session("fri-1330-room-tbc", "Friday", "13:30", "14:45", "Room TBC", "Funk Track 1", "Jamica & Mike", true),
  session("fri-1515-ankersaal", "Friday", "15:15", "16:30", "Ankersaal", "Competition Track", "Julie & Dan", true),
  session("fri-1515-kantine", "Friday", "15:15", "16:30", "Kantine", "", "Leigh & Dara", true),
  session("fri-1515-studio", "Friday", "15:15", "16:30", "Studio", "", "Jenna & Dexter", true),
  session("fri-1515-lot", "Friday", "15:15", "16:30", "LOT", "Talk: Environmental Justice & The Blues", "Jamica", false),
  session("fri-1515-room-tbc", "Friday", "15:15", "16:30", "Room TBC", "Jukin (III–IV)", "Mike & Bibi", true),

  session("sat-1130-ankersaal", "Saturday", "11:30", "12:45", "Ankersaal", "", "Vicci & Adamo", true),
  session("sat-1130-superar-1", "Saturday", "11:30", "12:45", "Superar 1", "Groove in Motion 2", "Catherine", false),
  session("sat-1130-superar-2", "Saturday", "11:30", "12:45", "Superar 2", "", "Dexter", false),
  session("sat-1130-superar-3", "Saturday", "11:30", "12:45", "Superar 3", "Texas Shuffle", "Jenna & Kenneth", true),
  session("sat-1130-hilger", "Saturday", "11:30", "12:45", "Hilger", "Jukin (III–IV)", "Mike & Bibi", true),
  session("sat-1130-lot", "Saturday", "11:30", "12:45", "LOT", "Struttin' Track", "Alex & Ioanna", true),
  session("sat-1130-social-schule", "Saturday", "11:30", "12:45", "Social Schule", "", "Julie & Shawn", true),
  session("sat-1130-studio", "Saturday", "11:30", "12:45", "Studio", "", "Leigh & Dara", true),
  session("sat-1415-ankersaal", "Saturday", "14:15", "15:30", "Ankersaal", "", "Vicci & Adamo", true),
  session("sat-1415-superar-1", "Saturday", "14:15", "15:30", "Superar 1", "Solo Blues — Top Priorities", "Mike", false),
  session("sat-1415-superar-2", "Saturday", "14:15", "15:30", "Superar 2", "", "Kenneth", false),
  session("sat-1415-superar-3", "Saturday", "14:15", "15:30", "Superar 3", "", "Dexter", false),
  session("sat-1415-hilger", "Saturday", "14:15", "15:30", "Hilger", "Bluesifyin' Folk Dance", "Jamica", false),
  session("sat-1415-lot", "Saturday", "14:15", "15:30", "LOT", "", "Alex & Ioanna", true),
  session("sat-1415-social-schule", "Saturday", "14:15", "15:30", "Social Schule", "Competition Track", "Julie & Dan", true),
  session("sat-1415-studio", "Saturday", "14:15", "15:30", "Studio", "Understanding the Music", "Jenna & Shawn", false),
  session("sat-1600-superar-1", "Saturday", "16:00", "17:15", "Superar 1", "Funk Track 2", "Jamica & Mike", true),
  session("sat-1600-superar-2", "Saturday", "16:00", "17:15", "Superar 2", "Leader Choices", "Dexter & Kenneth", true),
  session("sat-1600-superar-3", "Saturday", "16:00", "17:15", "Superar 3", "", "Catherine", false),
  session("sat-1600-hilger", "Saturday", "16:00", "17:15", "Hilger", "Piedmont Track", "Bibi & Dara", true),
  session("sat-1600-lot", "Saturday", "16:00", "17:15", "LOT", "", "Alex & Ioanna", true),
  session("sat-1600-social-schule", "Saturday", "16:00", "17:15", "Social Schule", "", "Vicci & Adamo", true),
  session("sat-1600-studio", "Saturday", "16:00", "17:15", "Studio", "", "Jenna & Shawn", true),

  session("sun-1130-ankersaal", "Sunday", "11:30", "12:45", "Ankersaal", "Texas Shuffle", "Jenna & Kenneth", true),
  session("sun-1130-superar-1", "Sunday", "11:30", "12:45", "Superar 1", "", "Vicci & Adamo", true),
  session("sun-1130-superar-2", "Sunday", "11:30", "12:45", "Superar 2", "Groove in Motion 3", "Catherine", false),
  session("sun-1130-hilger", "Sunday", "11:30", "12:45", "Hilger", "Funk Track 3", "Jamica & Mike", true),
  session("sun-1130-lot", "Sunday", "11:30", "12:45", "LOT", "Struttin' Track", "Alex & Ioanna", true),
  session("sun-1130-social-schule", "Sunday", "11:30", "12:45", "Social Schule", "", "Julie & Shawn", true),
  session("sun-1130-studio", "Sunday", "11:30", "12:45", "Studio", "Piedmont Track", "Bibi & Dara", true),
  session("sun-1415-ankersaal", "Sunday", "14:15", "15:30", "Ankersaal", "", "Kenneth", false),
  session("sun-1415-superar-1", "Sunday", "14:15", "15:30", "Superar 1", "", "Vicci & Adamo", true),
  session("sun-1415-superar-2", "Sunday", "14:15", "15:30", "Superar 2", "", "Catherine", false),
  session("sun-1415-hilger", "Sunday", "14:15", "15:30", "Hilger", "Sexy / Not Sexy", "Jamica & Julie", false),
  session("sun-1415-lot", "Sunday", "14:15", "15:30", "LOT", "", "Alex & Ioanna", true),
  session("sun-1415-social-schule", "Sunday", "14:15", "15:30", "Social Schule", "Country Blues", "Jenna & Dara", true),
  session("sun-1415-studio", "Sunday", "14:15", "15:30", "Studio", "", "Dan", false),
  session("sun-1600-ankersaal", "Sunday", "16:00", "17:15", "Ankersaal", "Kenneth (Talk)", "Kenneth", false),
  session("sun-1600-superar-1", "Sunday", "16:00", "17:15", "Superar 1", "Competition DJing", "Dan", false),
  session("sun-1600-superar-2", "Sunday", "16:00", "17:15", "Superar 2", "", "Catherine", false),
  session("sun-1600-hilger", "Sunday", "16:00", "17:15", "Hilger", "", "Vicci & Adamo", true),
];

export const scheduleById = Object.fromEntries(
  schedule.map((classSession) => [classSession.id, classSession]),
);

export const scheduleDays = ["Friday", "Saturday", "Sunday"];

export const competitions = [
  { id: "solo_battle", label: "Solo Battle", roleRequired: false },
  { id: "open_mixnmatch", label: "Open MixMatch", roleRequired: true },
  { id: "newcomers_mixnmatch", label: "Newcomers MixMatch", roleRequired: true },
  { id: "strictly", label: "Strictly", roleRequired: true },
  { id: "fever_showcase", label: "Fever Showcase", roleRequired: false },
];

export const CLASS_DAILY_LIMIT = 5;
export const COMPETITION_PRICE_CENTS = 1000;
export const LUNCH_PRICE_CENTS = 1500;
