// sources/blaze.js
import { io } from "socket.io-client";
import axios from "axios";

/* ---------------------------------------------------------
   ⭐ Create EventSub subscription
--------------------------------------------------------- */
async function createSubscription({ sessionId, clientId, accessToken, channelId }) {
  try {
    const res = await axios.post(
      "https://api.blaze.stream/v1/events/subscriptions",
      {
        type: "channel.chat.message",
        sessionId,
        condition: { channelId }
      },
      {
        headers: {
          "client-id": clientId,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!res.data?.success) {
      console.error("[BLAZE] Subscription failed:", res.data);
    } else {
      console.log("[BLAZE] Subscribed to channel.chat.message");
    }
  } catch (err) {
    console.error("[BLAZE] Subscription error:", err.response?.data || err.message);
  }
}

/* ---------------------------------------------------------
   ⭐ Convert Blaze EventSub payload → overlay message
--------------------------------------------------------- */
function transformBlazeEvent(payload) {
  const sender = payload.sender || {};

  return {
    platform: "blaze",
    id: payload.messageId,
    username: sender.displayName || sender.username || "Unknown",
    avatar: sender.avatarUrl || null,
    badges: sender.roles || [],
    html: payload.message || "",
    timestamp: payload.createdAt || Date.now()
  };
}

/* ---------------------------------------------------------
   ⭐ Start Blaze EventSub Socket.IO client
--------------------------------------------------------- */
export function startBlaze(broadcast) {
  const channelId = process.env.BLAZE_CHANNEL_ID;
  const clientId = process.env.BLAZE_CLIENT_ID;
  const accessToken = process.env.BLAZE_ACCESS_TOKEN;

  if (!clientId || !accessToken) {
    console.error("[BLAZE] Missing BLAZE_CLIENT_ID or BLAZE_ACCESS_TOKEN");
    return;
  }

  console.log("[BLAZE] Connecting to EventSub…");

  // ⭐ Correct Socket.IO namespace + path
  const socket = io("https://blaze.stream", {
    path: "/ws",
    transports: ["websocket"],
    auth: {
      token: accessToken,
      "client-id": clientId
    }
  });

  /* ---------------------------------------------------------
     ⭐ When connected, Blaze sends session_welcome
  --------------------------------------------------------- */
  socket.on("session_welcome", async ({ sessionId }) => {
    console.log("[BLAZE] Session ready:", sessionId);

    await createSubscription({
      sessionId,
      clientId,
      accessToken,
      channelId
    });
  });

  /* ---------------------------------------------------------
     ⭐ Handle EventSub notifications
  --------------------------------------------------------- */
  socket.on("eventsub", (message) => {
    const { metadata, payload } = message;

    if (metadata.subscriptionType !== "channel.chat.message") return;

    const normalized = transformBlazeEvent(payload);
    broadcast(normalized);
  });

  socket.on("connect_error", (err) => {
    console.error("[BLAZE] Socket.IO connection failed:", err.message);
  });

  socket.on("disconnect", () => {
    console.log("[BLAZE] Disconnected from Blaze");
  });

  console.log("[BLAZE] EventSub client started");
}
