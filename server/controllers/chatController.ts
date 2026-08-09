import { Request, Response } from "express";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Product from "../models/Products.js";
import mongoose from "mongoose";

const getUser = (req: Request) => (req as any).user;

// Start or get existing conversation for a product
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

    // Buyer cannot message themselves
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

    // Populate for frontend
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

// Get all my conversations (inbox)
export const getMyConversations = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const conversations = await Conversation.find({
      $or: [{ buyer: user._id }, { seller: user._id }],
      status: "active",
      updatedAt: { $gte: twoDaysAgo },
    })
      .populate("product", "name images price region")
      .populate("buyer", "name image")
      .populate("seller", "name storeName storeLogo image")
      .sort({ updatedAt: -1 })
      .lean();

    // Add a helpful flag so frontend knows the role of current user in each chat
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

// Get messages in a conversation
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

    // Security: only buyer or seller can view
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

// Send a message
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

    // Create the message
    const message = await Message.create({
      conversation: conversationId,
      sender: user._id,
      text: text.trim(),
      readBy: [user._id],
    });

    // Update conversation last message + unread counts
    conversation.lastMessage = {
      text: text.trim(),
      sender: user._id,
      createdAt: new Date(),
    };

    if (isBuyer) {
      conversation.unreadBySeller = (conversation.unreadBySeller || 0) + 1;
    } else {
      conversation.unreadByBuyer = (conversation.unreadByBuyer || 0) + 1;
    }

    await conversation.save();

    // Populate sender cleanly
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

// Mark conversation as read
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

    // Mark messages as read
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

// Optional: archive very old conversations (run occasionally)
export const archiveOldConversations = async () => {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  await Conversation.updateMany(
    {
      status: "active",
      updatedAt: { $lt: twoDaysAgo },
    },
    {
      $set: { status: "archived" },
    }
  );
};