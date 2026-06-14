// sources/velora.js
// Velora Socket.IO integration
// - Chat via Socket.IO (/chat namespace)
// - Rewards via events + HTML fetch
// - Avatar enrichment
// - Badge caching
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

// Badge cache
const badgeCache = Object.create(null);

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

// Normalize badges from payload into icon URLs
function normalizeVeloraBadges(badgesRaw) {
  if (!Array.isArray(badgesRaw)) return [];

  return badgesRaw
    .map((b) => {
      if (!b) return null;

      const key = b.id || b.icon || JSON.stringify(b);

      if (badgeCache[key]) return badgeCache[key];

      const icon = b.icon || null;
      if (!icon) return null;

      badgeCache[key] = icon;
      return icon;
    })
    .filter(Boolean);
}

// Map message type
function mapVeloraMessageType(data) {
  if (!data) return "chat";
  if (data.is_action) return "action";
  if (data.is_system) return "system";
  return "chat";
}

// MAIN SOCKET.IO HANDLER
function startVeloraSocketIO(broadcast) {
  if (!VELORA_TOKEN || VELORA_TOKEN.includes("PASTE_YOUR")) {
    console.error(
      "[Velora] VELORA_TOKEN is not set. Set it in env or in sources/velora.js."
    );
    return;
  }

  if (!VELORA_CHANNEL_ID || VELORA_CHANNEL_ID.includes("PASTE_YOUR")) {
    console.error(
      "[Velora] VELORA_CHANNEL_ID is not set. Set it in env or in sources/velora.js."
    );
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

    // Join your channel
    console.log("[Velora] Joining channel:", VELORA_CHANNEL_ID);
    chatSocket.emit("joinChannel", {
      channelId: VELORA_CHANNEL_ID,
    });

    // Optional: fetch pinned message, raid status, etc.
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

  // DEBUG: log everything so we can see real event names
  chatSocket.onAny((event, payload) => {
    console.log("[Velora] EVENT:", event, JSON.stringify(payload));

    // Handle chat messages (best-guess event names)
    if (
      event === "message" ||
      event === "chatMessage" ||
      event === "messageCreated"
    ) {
      handleVeloraChatEvent(payload, broadcast);
      return;
    }

    // Handle reward redemptions (best-guess event names)
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

  // Shape here is inferred; adjust once you see real logs
  const data = payload.data || payload;

  const username =
    data.username || data.displayName || data.user?.username || null;

  // Velora usually has HTML with emotes
  const html =
    data.message_html ||
    data.html ||
    data.message ||
    data.text ||
    "";

  const badges = normalizeVeloraBadges(data.badges || data.userBadges || []);

  const messageType = mapVeloraMessageType(data);

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
    messageType,
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
