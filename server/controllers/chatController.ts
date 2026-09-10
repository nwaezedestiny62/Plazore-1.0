import { Request, Response } from "express";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Product from "../models/Products.js";
import mongoose from "mongoose";
import { sendNotification } from "../utils/sendNotification.js";

const getUser = (req: Request) => (req as any).user;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

async function notifyChatRecipient(opts: {
  conversation: any;
  senderId: any;
  senderIsBuyer: boolean;
  text: string;
}) {
  const buyerId = String(opts.conversation.buyer?._id || opts.conversation.buyer);
  const sellerId = String(opts.conversation.seller?._id || opts.conversation.seller);
  const sender = String(opts.senderId);
  const recipientId = opts.senderIsBuyer ? sellerId : buyerId;

  if (!recipientId || recipientId === sender) {
    return;
  }

  let productName = "";
  let productId =
    opts.conversation.product?._id || opts.conversation.product || null;

  if (opts.conversation.product?.name) {
    productName = String(opts.conversation.product.name);
  } else if (productId) {
    try {
      const product = await Product.findById(productId).select("name").lean();
      productName = String((product as any)?.name || "");
    } catch {
      /* ignore */
    }
  }

  const preview = String(opts.text || "").trim().slice(0, 140);
  const title = opts.senderIsBuyer ? "New buyer message" : "New store message";
  const message = productName
    ? `${preview || "New message"} · ${productName}`
    : preview || "You have a new message on Plazore.";

  await sendNotification({
    userId: recipientId,
    type: "chat_message",
    title,
    message,
    conversationId: String(opts.conversation._id),
    productId: productId ? String(productId) : undefined,
    productName: productName || undefined,
    link: `/chat/${opts.conversation._id}`,
  });
}

export const startConversation = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required",
      });
    }

    const product = await Product.findById(productId).select(
      "seller isActive name images price"
    );

    if (!product || product.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (String(product.seller) === String(user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot message yourself",
      });
    }

    let conversation = await Conversation.findOne({
      buyer: user._id,
      product: productId,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        product: productId,
        buyer: user._id,
        seller: product.seller,
      });
    }

    await conversation.populate([
      { path: "product", select: "name images price" },
      { path: "buyer", select: "name image" },
      { path: "seller", select: "name storeName storeLogo image" },
    ]);

    return res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error("startConversation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const getMyConversations = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const twoDaysAgo = new Date(Date.now() - TWO_DAYS_MS);

    const conversations = await Conversation.find({
      $or: [{ buyer: user._id }, { seller: user._id }],
      status: "active",
      "lastMessage.text": { $exists: true, $nin: [null, ""] },
      "lastMessage.createdAt": { $gte: twoDaysAgo },
    })
      .populate("product", "name images price region")
      .populate("buyer", "name image")
      .populate("seller", "name storeName storeLogo image")
      .sort({ "lastMessage.createdAt": -1 })
      .lean();

    const enriched = conversations.map((conv: any) => {
      const isBuyer = String(conv.buyer?._id || conv.buyer) === String(user._id);
      const isSeller = String(conv.seller?._id || conv.seller) === String(user._id);

      return {
        ...conv,
        myRole: isBuyer ? "buyer" : isSeller ? "seller" : null,
        unreadCount: isBuyer
          ? conv.unreadByBuyer || 0
          : isSeller
          ? conv.unreadBySeller || 0
          : 0,
      };
    });

    return res.json({
      success: true,
      data: enriched,
    });
  } catch (error: any) {
    console.error("getMyConversations error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const conversationId = String(req.params.conversationId);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const isParticipant =
      String(conversation.buyer) === String(user._id) ||
      String(conversation.seller) === String(user._id);

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Not allowed",
      });
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "name image")
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error("getMessages error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const conversationId = String(req.params.conversationId);
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message text is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const isBuyer = String(conversation.buyer) === String(user._id);
    const isSeller = String(conversation.seller) === String(user._id);

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "Not allowed",
      });
    }

    const trimmed = text.trim();

    const message = await Message.create({
      conversation: conversationId,
      sender: user._id,
      text: trimmed,
      readBy: [user._id],
    });

    conversation.lastMessage = {
      text: trimmed,
      sender: user._id,
      createdAt: new Date(),
    };

    if (isBuyer) {
      conversation.unreadBySeller = (conversation.unreadBySeller || 0) + 1;
    } else {
      conversation.unreadByBuyer = (conversation.unreadByBuyer || 0) + 1;
    }

    await conversation.save();

    await notifyChatRecipient({
      conversation,
      senderId: user._id,
      senderIsBuyer: isBuyer,
      text: trimmed,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name image")
      .lean();

    return res.status(201).json({
      success: true,
      data: populatedMessage,
    });
  } catch (error: any) {
    console.error("sendMessage error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const conversationId = String(req.params.conversationId);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const isBuyer = String(conversation.buyer) === String(user._id);
    const isSeller = String(conversation.seller) === String(user._id);

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "Not allowed",
      });
    }

    if (isBuyer) conversation.unreadByBuyer = 0;
    if (isSeller) conversation.unreadBySeller = 0;

    await conversation.save();

    await Message.updateMany(
      {
        conversation: conversationId,
        readBy: { $ne: user._id },
      },
      {
        $addToSet: { readBy: user._id },
      }
    );

    return res.json({
      success: true,
    });
  } catch (error: any) {
    console.error("markAsRead error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const archiveOldConversations = async () => {
  const twoDaysAgo = new Date(Date.now() - TWO_DAYS_MS);

  await Conversation.updateMany(
    {
      status: "active",
      $or: [
        { "lastMessage.createdAt": { $exists: false } },
        { "lastMessage.createdAt": { $lt: twoDaysAgo } },
        { "lastMessage.text": { $in: [null, ""] } },
      ],
    },
    {
      $set: { status: "archived" },
    }
  );
};