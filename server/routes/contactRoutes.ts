import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createContact,
  createReport,
  myContacts,
  myContactDetail,
  replyMyContact,
} from "../controllers/contactController.js";

const ContactRouter = express.Router();

ContactRouter.post("/", protect, createContact);
ContactRouter.post("/report", protect, createReport);
ContactRouter.get("/mine", protect, myContacts);
ContactRouter.get("/mine/:id", protect, myContactDetail);
ContactRouter.post("/mine/:id/reply", protect, replyMyContact);

export default ContactRouter;