import { contentHandlers } from "../../../../db/app";

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };

export default function handler(req, res) {
  const { action } = req.query;
  if (action !== "door-sessions" && action !== "door-verify") {
    return res.status(404).end();
  }
  return contentHandlers.openScanner[action](req, res);
}
