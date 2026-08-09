import express from "express";
import {
  startConversation,
  getMyConversations,
  getMessages,
  sendMessage,
  markAsRead,
} from "../controllers/chatController.js";
import { protect } from "../middleware/auth.js";

const ChatRouter = express.Router();

ChatRouter.use(protect); // all routes require login

ChatRouter.post("/start", startConversation);           // start or get existing chat for a product
ChatRouter.get("/conversations", getMyConversations);   // inbox list
ChatRouter.get("/:conversationId/messages", getMessages);
ChatRouter.post("/:conversationId/messages", sendMessage);
ChatRouter.patch("/:conversationId/read", markAsRead);

export default ChatRouter;