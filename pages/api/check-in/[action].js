import { sql } from "../../../db/db";
import { createArrivalHandlers } from "../../../lib/app/arrival-http";
import { createArrivalStore } from "../../../lib/app/arrival-store";

const handlers = createArrivalHandlers(createArrivalStore(sql));
export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };

export default function handler(req, res) {
  const { action } = req.query;
  if (!Object.prototype.hasOwnProperty.call(handlers, action))
    return res.status(404).end();
  return handlers[action](req, res);
}
