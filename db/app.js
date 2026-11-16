import { createContentStore } from "../lib/app/content-store";
import { createContentHandlers } from "../lib/app/content-http";
import { sql } from "./db";
import { registrationStore } from "./reg2026";
import { createAttendeeStore } from "../lib/app/store";
import { createAppHandlers } from "../lib/app/http";
import { createDoorStore } from "../lib/app/door-store";
import { createVolunteerStore } from "../lib/app/volunteer-store";

export const attendeeStore = createAttendeeStore(sql, registrationStore);
export const contentStore = createContentStore(sql);
export const contentHandlers = createContentHandlers(
  contentStore,
  attendeeStore,
  createDoorStore(sql, registrationStore),
  createVolunteerStore(sql),
);
export const appHandlers = createAppHandlers(attendeeStore, contentStore);
