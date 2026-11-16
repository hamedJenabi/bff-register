import { registrationStore } from "../../../db/reg2026";
import { createScheduleHandler } from "../../../lib/app/schedule";

export default createScheduleHandler(registrationStore);
