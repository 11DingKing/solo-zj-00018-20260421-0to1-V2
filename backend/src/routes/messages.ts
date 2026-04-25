import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { AuthVariables } from "../middleware/auth";
import Message from "../models/Message";
import User from "../models/User";
import { Types } from "mongoose";
import { wsManager } from "../utils/websocket";

const messages = new Hono<{ Variables: AuthVariables }>();

messages.post("/", authMiddleware, async (c) => {
  try {
    const senderId = c.get("userId");
    const { receiverId, content } = await c.req.json();

    if (!receiverId) {
      return c.json({ error: "Receiver ID is required" }, 400);
    }

    if (!Types.ObjectId.isValid(receiverId)) {
      return c.json({ error: "Invalid receiver ID" }, 400);
    }

    const receiverObjId = new Types.ObjectId(receiverId);

    if (senderId.equals(receiverObjId)) {
      return c.json({ error: "Cannot send message to yourself" }, 400);
    }

    if (!content || !content.trim()) {
      return c.json({ error: "Content is required" }, 400);
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > 500) {
      return c.json({ error: "Content cannot exceed 500 characters" }, 400);
    }

    const receiver = await User.findById(receiverObjId);
    if (!receiver) {
      return c.json({ error: "Receiver not found" }, 404);
    }

    const message = new Message({
      senderId,
      receiverId: receiverObjId,
      content: trimmedContent,
      isRead: false,
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "username")
      .populate("receiverId", "username");

    const messageObj = populatedMessage!.toObject();
    const responseMessage = {
      ...messageObj,
      sender: messageObj.senderId,
      receiver: messageObj.receiverId,
    };

    wsManager.sendToUser(receiverObjId, {
      type: "new_message",
      data: responseMessage,
    });

    return c.json(responseMessage, 201);
  } catch (error) {
    console.error("Send message error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

messages.get("/conversation/:userId", authMiddleware, async (c) => {
  try {
    const currentUserId = c.get("userId");
    const { userId } = c.req.param();
    const limit = parseInt(c.req.query("limit") || "50");
    const before = c.req.query("before");

    if (!Types.ObjectId.isValid(userId)) {
      return c.json({ error: "Invalid user ID" }, 400);
    }

    const otherUserId = new Types.ObjectId(userId);

    if (limit > 200) {
      return c.json({ error: "Limit cannot exceed 200" }, 400);
    }

    const filter: Record<string, unknown> = {
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    };

    if (before) {
      if (!Types.ObjectId.isValid(before)) {
        return c.json({ error: "Invalid before cursor" }, 400);
      }
      filter._id = { $gt: new Types.ObjectId(before) };
    }

    const messageList = await Message.find(filter)
      .sort({ _id: 1 })
      .limit(limit)
      .populate("senderId", "username")
      .populate("receiverId", "username");

    const hasMore = messageList.length === limit;

    const messagesWithSenderReceiver = messageList.map((msg) => {
      const msgObj = msg.toObject();
      return {
        ...msgObj,
        sender: msgObj.senderId,
        receiver: msgObj.receiverId,
      };
    });

    return c.json({
      data: messagesWithSenderReceiver,
      hasMore,
      nextCursor: hasMore
        ? messageList[messageList.length - 1]._id.toString()
        : null,
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

messages.get("/conversations", authMiddleware, async (c) => {
  try {
    const currentUserId = c.get("userId");

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
        },
      },
      {
        $addFields: {
          otherUserId: {
            $cond: {
              if: { $eq: ["$senderId", currentUserId] },
              then: "$receiverId",
              else: "$senderId",
            },
          },
          isSentByMe: { $eq: ["$senderId", currentUserId] },
        },
      },
      {
        $sort: { _id: -1 },
      },
      {
        $group: {
          _id: "$otherUserId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", currentUserId] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { "lastMessage._id": -1 },
      },
    ]);

    const userIds = conversations.map((convItem) => convItem._id);
    const users = await User.find({ _id: { $in: userIds } }).select("username");
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const result = conversations.map((conv) => {
      const user = userMap.get(conv._id.toString());
      const lastMsg = conv.lastMessage;
      return {
        otherUser: user
          ? {
              _id: user._id,
              username: user.username,
            }
          : null,
        lastMessage: {
          _id: lastMsg._id,
          content: lastMsg.content,
          senderId: lastMsg.senderId,
          receiverId: lastMsg.receiverId,
          isRead: lastMsg.isRead,
          createdAt: lastMsg.createdAt,
          isSentByMe: lastMsg.isSentByMe,
        },
        unreadCount: conv.unreadCount,
      };
    });

    return c.json({
      data: result,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

messages.put("/conversation/:userId/read", authMiddleware, async (c) => {
  try {
    const currentUserId = c.get("userId");
    const { userId } = c.req.param();

    if (!Types.ObjectId.isValid(userId)) {
      return c.json({ error: "Invalid user ID" }, 400);
    }

    const otherUserId = new Types.ObjectId(userId);

    const result = await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      },
    );

    wsManager.sendToUser(otherUserId, {
      type: "conversation_read",
      data: {
        userId: currentUserId.toString(),
        readAt: new Date().toISOString(),
      },
    });

    return c.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark conversation read error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

messages.get("/unread-count", authMiddleware, async (c) => {
  try {
    const currentUserId = c.get("userId");

    const count = await Message.countDocuments({
      receiverId: currentUserId,
      isRead: false,
    });

    return c.json({
      unreadCount: count,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default messages;
