export const PARTNER_CLASS_CAPACITY = 40;
export const CLASS_ROLES = ["lead", "follow", "switch"];
export const CLASS_ROLE_LABELS = { lead: "Lead", follow: "Follow", switch: "Switch" };

export const classAvailability = (session, occupied = {}) => {
  if (session.format === "talk") return { total: { capacity: null, remaining: null, unlimited: true } };
  const capacity = session.capacity.total ?? (session.partnerClass ? PARTNER_CLASS_CAPACITY : 30);
  const total = Object.values(occupied).reduce((sum, count) => sum + count, 0);
  const remaining = Math.max(0, capacity - total);
  const places = { total: { capacity, remaining } };
  if (session.partnerClass) {
    const followCapacity = Math.floor(capacity / 2);
    places.lead = { capacity, remaining };
    places.switch = { capacity, remaining };
    places.follow = { capacity: followCapacity, remaining: Math.max(0, Math.min(remaining, followCapacity - (occupied.follow || 0))) };
  }
  return places;
};
