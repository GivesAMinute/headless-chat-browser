// sources/velora.js
// Velora Socket.IO integration
// - Chat via Socket.IO (/chat namespace)
// - Rewards via events + HTML fetch
// - Avatar enrichment
// - Badge mapping (icon + label)
// - Emote URL fixing
// - Message type tagging + debug logging

import { io } from "socket.io-client";

// ⭐ FILL THESE IN
const VELORA_TOKEN =
  process.env.VELORA_TOKEN ||
  "YOUR_TOKEN_HERE";

const VELORA_CHANNEL_ID =
  process.env.VELORA_CHANNEL_ID ||
  "4f1cb975-eace-4650-8246-053007bd0036";

// Avatar cache
const avatarCache = Object.create(null);

// Deduplication cache
const seenMessageIds = new Set();

// ⭐ Fix Velora emote URLs (relative → absolute)
function fixVeloraEmoteURLs(html) {
  if (!html) return html;

  // Convert <img src="/something"> → https://velora.tv/something
  return html.replace(
    /<img([^>]+)src="\/([^">]+)"/g,
    `<img$1src="https://velora.tv/$2"`
  );
}

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

// ⭐ Badge mapping → { icon, label }
function normalizeVeloraBadges(badgesRaw, data) {
  if (!Array.isArray(badgesRaw)) return [];

  const out = [];

  for (const b of badgesRaw) {
    if (typeof b !== "string") continue;

    // Subscriber badge (safe)
    if (
      b === "subscriber" &&
      data.subscriptionBadge &&
      data.subscriptionBadge.staticAssetUrl
    ) {
      out.push({
        icon: data.subscriptionBadge.staticAssetUrl,
        label: data.subscriptionBadge.label || "Subscriber",
      });
      continue;
    }

    // ⭐ Broadcaster badge (LOCAL FILE)
    if (b === "broadcaster") {
      out.push({
        icon: "/icons/StreamerBroadcasterBadge.png",
        label: "Broadcaster",
      });
      continue;
    }

    // Moderator badge
    if (b === "moderator") {
      out.push({
        icon: "https://assets.velora.tv/badges/mod.png",
        label: "Moderator",
      });
      continue;
    }

    // Fallback
    out.push({
      icon: null,
      label: b,
    });
  }

  return out;
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

    if (event === "newMessage") {
      handleVeloraChatEvent(payload, broadcast);
      return;
    }

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

  // ⭐ Deduplicate
  if (payload.id) {
    if (seenMessageIds.has(payload.id)) {
      return;
    }
    seenMessageIds.add(payload.id);

    if (seenMessageIds.size > 5000) {
      seenMessageIds.clear();
    }
  }

  const data = payload;

  const username =
    data.username ||
    data.displayName ||
    data.user?.username ||
    null;

  let html =
    data.message_html ||
    data.html ||
    data.message ||
    "";

  // ⭐ Fix emote URLs
  html = fixVeloraEmoteURLs(html);

  const badges = normalizeVeloraBadges(data.badges, data);

  const avatar =
    data.avatarUrl ||
    data.user?.avatarUrl ||
    (await fetchVeloraAvatar(username));

  const out = {
    platform: "velora",
    username,
    html,
    badges, // [{icon, label}]
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
