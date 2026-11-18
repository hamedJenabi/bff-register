import { sql } from "./db";
import { createRegistrationStore } from "../lib/reg2026/store";
export const registrationStore = createRegistrationStore(sql);
