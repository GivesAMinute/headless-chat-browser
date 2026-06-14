// sources/velora.js
// Velora Socket.IO integration
// - Chat via Socket.IO (/chat namespace)
// - Rewards via events + HTML fetch
// - Avatar enrichment
// - Badge passthrough
// - Emote-safe HTML passthrough
// - Message type tagging + debug logging

import { io } from "socket.io-client";

// ⭐ FILL THESE IN
const VELORA_TOKEN =
  process.env.VELORA_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZjFjYjk3NS1lYWNlLTQ2NTAtODI0Ni0wNTMwMDdiZDAwMzYiLCJ1c2VybmFtZSI6IkdpdmVzQU1pbnV0ZSIsImVtYWlsIjoiYmVub25rb2Vic2NoQGdtYWlsLmNvbSIsInJvbGUiOiJjcmVhdG9yIiwiaWF0IjoxNzgxMzg2NDk2LCJleHAiOjE3ODE5OTEyOTYsImF1ZCI6InZlbG9yYS1hcGkiLCJpc3MiOiJ2ZWxvcmEudHYifQ.AUDMnQ7AeJMfobcOiGjBSLSx5X0aOqRwdsDS_ROTWZg";

const VELORA_CHANNEL_ID =
  process.env.VELORA_CHANNEL_ID ||
  "4f1cb975-eace-4650-8246-053007bd0036"; // e.g. "4f1cb975-eace-4650-8246-053007bd0036"

// Avatar cache
const avatarCache = Object.create(null);

export function startVelora(broadcast) {
  console.log("Starting Velora Socket.IO ingestion…");
  startVeloraSocketIO(broadcast);
}

// Fetch avatar
async function fetchVeloraAvatar(username) {
  if (!username) return null;

  if (Object.prototype.hasOwnProperty.call(avatarCache, username)) {
    return avatarCache[username];
  }

  try {
    const res = await fetch(
      `https://velora.tv/api/users/${encodeURIComponent(username)}`
    );

    if (!res.ok) {
      console.warn("Velora avatar fetch failed:", username, res.status);
      avatarCache[username] = null;
      return null;
    }

    const data = await res.json();
    const url = data.avatarUrl || null;

    avatarCache[username] = url;
    return url;
  } catch (err) {
    console.error("Velora avatar fetch error:", err);
    avatarCache[username] = null;
    return null;
  }
}

// MAIN SOCKET.IO HANDLER
function startVeloraSocketIO(broadcast) {
  if (!VELORA_TOKEN || VELORA_TOKEN.includes("PASTE_")) {
    console.error("[Velora] ERROR: VELORA_TOKEN is not set.");
    return;
  }

  if (!VELORA_CHANNEL_ID || VELORA_CHANNEL_ID.includes("PASTE_")) {
    console.error("[Velora] ERROR: VELORA_CHANNEL_ID is not set.");
    return;
  }

  console.log("[Velora] Connecting via Socket.IO…");

  const chatSocket = io("https://api.velora.tv/chat", {
    path: "/socket.io",
    transports: ["websocket"],
    auth: {
      token: VELORA_TOKEN,
    },
  });

  chatSocket.on("connect", () => {
    console.log("[Velora] Socket.IO connected. id:", chatSocket.id);

    console.log("[Velora] Joining channel:", VELORA_CHANNEL_ID);
    chatSocket.emit("joinChannel", {
      channelId: VELORA_CHANNEL_ID,
    });

    chatSocket.emit("getPinnedMessage", {
      channelId: VELORA_CHANNEL_ID,
    });

    chatSocket.emit("getRaidSessionStatus", {
      channelId: VELORA_CHANNEL_ID,
    });
  });

  chatSocket.on("connect_error", (err) => {
    console.error("[Velora] Socket.IO connect_error:", err.message);
  });

  chatSocket.on("disconnect", (reason) => {
    console.warn("[Velora] Socket.IO disconnected:", reason);
  });

  // DEBUG: log everything
  chatSocket.onAny((event, payload) => {
    console.log("[Velora] EVENT:", event, JSON.stringify(payload));

    // ⭐ REAL CHAT EVENT
    if (event === "newMessage") {
      handleVeloraChatEvent(payload, broadcast);
      return;
    }

    // Possible reward events
    if (
      event === "rewardRedeemed" ||
      event === "channelPointRedeemed" ||
      event === "channelPointsRedeemed"
    ) {
      handleVeloraRewardEvent(payload, broadcast);
      return;
    }
  });
}

// Handle chat event payload → broadcast
async function handleVeloraChatEvent(payload, broadcast) {
  if (!payload) return;

  const data = payload;

  const username =
    data.username ||
    data.displayName ||
    data.user?.username ||
    null;

  // Velora uses plain text "message"
  const html =
    data.message_html ||
    data.html ||
    data.message || // ⭐ real field
    "";

  // Badges are simple strings like ["broadcaster","subscriber"]
  const badges = Array.isArray(data.badges) ? data.badges : [];

  const avatar =
    data.avatarUrl ||
    data.user?.avatarUrl ||
    (await fetchVeloraAvatar(username));

  const out = {
    platform: "velora",
    username,
    html,
    badges,
    avatar,
    messageType: "chat",
  };

  console.log("[Velora] CHAT OUT:", out);
  broadcast(out);
}

// Handle reward event payload → fetch HTML → broadcast
async function handleVeloraRewardEvent(payload, broadcast) {
  if (!payload) return;

  const data = payload.data || payload;
  const reward = data.reward || data;

  const username = data.username || data.user?.username || null;

  console.log("[Velora] REWARD IN:", payload);

  let rewardHTML = null;

  try {
    if (reward.id) {
      const res = await fetch(
        `https://api.velora.tv/api/channel-points/rewards/${reward.id}`,
        {
          headers: {
            Authorization: `Bearer ${VELORA_TOKEN}`,
          },
        }
      );

      if (res.ok) {
        const json = await res.json();
        rewardHTML = json?.html || null;
      } else {
        console.warn("[Velora] Reward fetch failed:", res.status);
      }
    }
  } catch (err) {
    console.error("[Velora] Reward fetch error:", err);
  }

  const out = {
    platform: "velora",
    type: "reward",
    username,
    rewardName: reward.name || null,
    rewardIcon: reward.icon || null,
    rewardHTML,
  };

  console.log("[Velora] REWARD OUT:", out);
  broadcast(out);
}
