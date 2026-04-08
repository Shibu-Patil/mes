import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PENDING_MESSAGES_FILE = path.join(__dirname, "../data/pendingMessages.json");

// Ensure data directory exists
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// In-memory message queue
let messageQueue = [];

/* =========================
   LOAD PENDING MESSAGES FROM FILE
========================= */
export const loadPendingMessages = () => {
  try {
    if (fs.existsSync(PENDING_MESSAGES_FILE)) {
      const data = fs.readFileSync(PENDING_MESSAGES_FILE, "utf-8");
      messageQueue = JSON.parse(data) || [];
      console.log(`✅ Loaded ${messageQueue.length} pending messages from file`);
    }
  } catch (err) {
    console.error("Error loading pending messages:", err.message);
    messageQueue = [];
  }
};

/* =========================
   SAVE MESSAGES TO FILE
========================= */
export const savePendingMessages = () => {
  try {
    fs.writeFileSync(
      PENDING_MESSAGES_FILE,
      JSON.stringify(messageQueue, null, 2)
    );
  } catch (err) {
    console.error("Error saving pending messages:", err.message);
  }
};

/* =========================
   ADD MESSAGE TO QUEUE
========================= */
export const addMessageToQueue = (fromUserId, fromEmail, toEmail, toUserId, message, type = "text") => {
  const messageObj = {
    id: Date.now(),
    fromUserId,
    fromEmail,
    toEmail,
    toUserId,
    message,
    type,
    createdAt: new Date().toISOString(),
    delivered: false
  };

  messageQueue.push(messageObj);
  savePendingMessages();
  
  console.log(`📦 Message cached for offline user ${toEmail}`);
  return messageObj;
};

/* =========================
   GET PENDING MESSAGES FOR USER
========================= */
export const getPendingMessagesForUser = (userId) => {
  return messageQueue.filter(msg => msg.toUserId === userId && !msg.delivered);
};

/* =========================
   MARK MESSAGE AS DELIVERED
========================= */
export const markMessageAsDelivered = (messageId) => {
  const msg = messageQueue.find(m => m.id === messageId);
  if (msg) {
    msg.delivered = true;
    savePendingMessages();
    console.log(`✅ Message ${messageId} marked as delivered`);
  }
};

/* =========================
   REMOVE MESSAGE FROM QUEUE
========================= */
export const removeMessageFromQueue = (messageId) => {
  messageQueue = messageQueue.filter(m => m.id !== messageId);
  savePendingMessages();
};

/* =========================
   CLEAR ALL DELIVERED MESSAGES
========================= */
export const clearDeliveredMessages = () => {
  messageQueue = messageQueue.filter(m => !m.delivered);
  savePendingMessages();
  console.log("🧹 Cleared delivered messages");
};

/* =========================
   GET ALL PENDING MESSAGES
========================= */
export const getAllPendingMessages = () => {
  return messageQueue;
};

export default {
  loadPendingMessages,
  savePendingMessages,
  addMessageToQueue,
  getPendingMessagesForUser,
  markMessageAsDelivered,
  removeMessageFromQueue,
  clearDeliveredMessages,
  getAllPendingMessages
};
