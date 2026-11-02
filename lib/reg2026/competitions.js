import { competitions } from "./catalog";
import { sessionsOverlap } from "./schedule";

const soloSession = { day: "Saturday", start: "16:00", end: "17:15" };
export const SOLO_COMPETITION_NOTICE = "Solo Battle competitors must attend Cuttin' for Solo competitors only on Saturday, 16:00–17:15. You cannot take another class during this time.";
export const conflictsWithSolo = (session) => sessionsOverlap(session, soloSession);

export const competitionAvailability = (entries) => Object.fromEntries(competitions.map((competition) => [
  competition.id,
  competition.capacity ? Object.fromEntries(Object.entries(competition.capacity).map(([pool, capacity]) => {
    const occupied = entries.find((entry) => entry.competition_id === competition.id && entry.pool === pool)?.occupied || 0;
    return [pool, { capacity, remaining: Math.max(0, capacity - occupied) }];
  })) : { total: { capacity: null, remaining: null, unlimited: true } },
]));
