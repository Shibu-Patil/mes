import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import songRoutes from "./routes/songRoutes.js"; // your song routes

dotenv.config();
connectDB();

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
  }
});

// In-memory room state (OK for now)
const musicRooms = {};

// ======================
// SOCKET.IO LOGIC
// ======================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

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
