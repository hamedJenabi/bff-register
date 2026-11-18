import { festivalDates } from "./calendar";

// Share only published class details. Bookings, capacity and access credentials
// stay behind the participant and organizer endpoints.
export const schedulePayload = (sessions) => ({
  catalog: sessions.map((session) => ({
    sessionId: session.id,
    title: session.title,
    teachers: session.teachers,
    description: session.description,
    day: session.day,
    date: session.date || null,
    start: session.start,
    end: session.end,
    room: session.room,
    levels: session.levels || "",
    format: session.format || (session.partnerClass ? "partner" : "solo"),
    bookable: session.bookable !== false,
    role: null,
    detailsMissing: false,
    source: "catalog",
  })),
  timezone: "Europe/Vienna",
  festivalDates: festivalDates(sessions),
});

export const createScheduleHandler = (registration) => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  try {
    return res.json(schedulePayload(await registration.schedule()));
  } catch {
    return res.status(503).json({
      error: "The festival schedule is temporarily unavailable. Please try again.",
    });
  }
};
