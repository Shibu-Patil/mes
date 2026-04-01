import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import songRoutes from "./routes/songRoutes.js"; // your song routes
import User from "./models/User.js";
import {
  loadPendingMessages,
  addMessageToQueue,
  getPendingMessagesForUser,
  markMessageAsDelivered,
  clearDeliveredMessages
} from "./utils/messageQueue.js";

dotenv.config();
connectDB();

// Load pending messages from file on startup
loadPendingMessages();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/songs", songRoutes); // upload/list/stream/delete

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 100 * 1024 * 1024 // 100MB
});

// In-memory room state (OK for now)
const musicRooms = {};

// Track online users: { userId: socketId }
const onlineUsers = {};

// ======================
// SOCKET.IO LOGIC
// ======================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  /* =========================
     USER ONLINE STATUS
  ========================= */
  socket.on("user-online", (userId) => {
    onlineUsers[userId] = socket.id;
    socket.userId = userId; // Store userId on socket for later cleanup
    
    // Check for pending messages and send them
    const pendingMessages = getPendingMessagesForUser(userId);
    if (pendingMessages.length > 0) {
      pendingMessages.forEach(msg => {
        socket.emit("receive-private-message", {
          id: msg.id,
          fromUserId: msg.fromUserId,
          fromEmail: msg.toEmail, // This is sender info, adjust as needed
          message: msg.message,
          type: msg.type,
          createdAt: msg.createdAt,
          wasPending: true // Indicate this was a cached message
        });
        markMessageAsDelivered(msg.id);
      });
      console.log(`✅ Delivered ${pendingMessages.length} pending messages to ${userId}`);
    }
    
    // Broadcast to all users that someone came online
    io.emit("user-status", {
      userId,
      status: "online",
      onlineUsers: Object.keys(onlineUsers)
    });
    console.log(`User ${userId} is online. Online users:`, Object.keys(onlineUsers));
  });

  /* =========================
     JOIN CHAT / MUSIC ROOM
  ========================= */
  socket.on("join-room", ({ roomId, userId }) => {
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);

    // send current music state to late joiner
    if (musicRooms[roomId]) {
      socket.emit("music-state", musicRooms[roomId]);
    }
  });

  /* =========================
     CHAT MESSAGE
  ========================= */
  socket.on("sendMessage", ({ senderId, roomId, type, content }) => {
    io.to(roomId).emit("receiveMessage", {
      senderId,
      type, // text | image | audio | video
      content,
      createdAt: new Date()
    });
  });

  /* =========================
     ONE-ON-ONE MESSAGING
  ========================= */
  socket.on("send-private-message", ({ fromUserId, toUserId, message, type = "text" }) => {
    const recipientSocketId = onlineUsers[toUserId];
    
    if (recipientSocketId) {
      // Send to recipient
      io.to(recipientSocketId).emit("receive-private-message", {
        fromUserId,
        fromName: socket.userName || "User",
        message,
        type,
        createdAt: new Date()
      });
      
      // Send confirmation back to sender
      socket.emit("message-sent", {
        toUserId,
        status: "delivered",
        timestamp: new Date()
      });
      console.log(`Message from ${fromUserId} to ${toUserId} delivered`);
    } else {
      // User offline, send error back to sender
      socket.emit("message-failed", {
        toUserId,
        reason: "User is offline",
        status: "failed"
      });
      console.log(`User ${toUserId} is offline`);
    }
  });

  /* =========================
     SEND MESSAGE BY EMAIL (Like WhatsApp)
  ========================= */
  socket.on("send-message-by-email", async ({ fromUserId, toEmail, message, type = "text" }) => {
    try {
      // Find user by email
      const recipientUser = await User.findOne({ email: toEmail });

      if (!recipientUser) {
        socket.emit("message-failed", {
          toEmail,
          reason: "User not found",
          status: "failed"
        });
        console.log(`❌ User with email ${toEmail} not found`);
        return;
      }

      const toUserId = recipientUser._id.toString();
      const recipientSocketId = onlineUsers[toUserId];

      if (recipientSocketId) {
        // Send to recipient (user is online)
        io.to(recipientSocketId).emit("receive-private-message", {
          fromUserId,
          fromName: socket.userName || "User",
          fromEmail: toEmail,
          message,
          type,
          createdAt: new Date(),
          wasPending: false
        });

        // Send confirmation back to sender
        socket.emit("message-sent", {
          toEmail,
          toUserId,
          status: "delivered",
          timestamp: new Date()
        });
        console.log(`✅ Message from ${fromUserId} to ${toEmail} delivered instantly`);
      } else {
        // User offline - cache message to file
        const cachedMsg = addMessageToQueue(fromUserId, toEmail, toUserId, message, type);
        
        socket.emit("message-sent", {
          toEmail,
          toUserId,
          status: "cached",
          reason: "User is offline - message will be delivered when they come online",
          timestamp: new Date()
        });
        console.log(`📦 Message from ${fromUserId} to ${toEmail} cached (user offline)`);
      }
    } catch (err) {
      socket.emit("message-failed", {
        toEmail,
        reason: err.message,
        status: "error"
      });
      console.error("Error sending message by email:", err);
    }
  });

  /* =========================
     GET ONLINE USERS
  ========================= */
  socket.on("get-online-users", () => {
    socket.emit("online-users-list", {
      onlineUsers: Object.keys(onlineUsers)
    });
  });

  /* =========================
     🎵 MUSIC EVENTS
  ========================= */

  // ▶️ PLAY SONG
  socket.on("play-song", ({ roomId, songId, time = 0 }) => {
    musicRooms[roomId] = {
      songId,
      isPlaying: true,
      currentTime: time
    };

    socket.to(roomId).emit("play-song", { songId, time });
  });

  // ⏸ PAUSE SONG
  socket.on("pause-song", ({ roomId, time }) => {
    if (musicRooms[roomId]) {
      musicRooms[roomId].isPlaying = false;
      musicRooms[roomId].currentTime = time;
    }

    socket.to(roomId).emit("pause-song", { time });
  });

  // ⏩ SEEK SONG
  socket.on("seek-song", ({ roomId, time }) => {
    if (musicRooms[roomId]) {
      musicRooms[roomId].currentTime = time;
    }

    socket.to(roomId).emit("seek-song", { time });
  });

  /* =========================
     DISCONNECT
  ========================= */
  socket.on("disconnect", () => {
    const userId = socket.userId;
    
    // Remove user from online users
    if (userId && onlineUsers[userId]) {
      delete onlineUsers[userId];
      
      // Broadcast to all users that someone went offline
      io.emit("user-status", {
        userId,
        status: "offline",
        onlineUsers: Object.keys(onlineUsers)
      });
      console.log(`User ${userId} is offline. Online users:`, Object.keys(onlineUsers));
    }
    
    // Periodically clean up delivered messages
    clearDeliveredMessages();
    
    console.log("User disconnected:", socket.id);
  });
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
