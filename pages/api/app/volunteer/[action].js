import { contentHandlers } from "../../../../db/app";
export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
export default function handler(req, res) {
  const action = req.query.action;
  if (!Object.prototype.hasOwnProperty.call(contentHandlers.volunteer, action))
    return res.status(404).end();
  return contentHandlers.volunteer[action](req, res);
}
