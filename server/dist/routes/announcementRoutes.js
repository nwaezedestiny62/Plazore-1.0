import express from "express";
import { getPublicAnnouncements } from "../controllers/announcementController.js";
const AnnouncementRouter = express.Router();
AnnouncementRouter.get("/", getPublicAnnouncements);
export default AnnouncementRouter;
