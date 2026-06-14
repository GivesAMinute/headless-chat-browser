// sources/velora.js
// Velora Socket.IO integration with global emote metadata support

import { io } from "socket.io-client";

const VELORA_TOKEN =
  process.env.VELORA_TOKEN || "YOUR_TOKEN_HERE";

const VELORA_CHANNEL_ID =
  process.env.VELORA_CHANNEL_ID || "4f1cb975-eace-4650-8246-053007bd0036";

// Avatar cache
const avatarCache = Object.create(null);

// Deduplication cache
const seenMessageIds = new Set();

// ⭐ Emote metadata caches
let globalEmotes = {};
let emoteLookup = {}; // name → URL

// ⭐ Fetch global emotes (correct API structure)
async function fetchGlobalEmotes() {
  try {
    const res = await fetch("https://api.velora.tv/api/emotes/global");
    if (!res.ok) {
      console.error("[Velora] Global emote fetch failed:", res.status);
      return;
    }

    const json = await res.json();
    globalEmotes = {};

    if (!json.collections || !Array.isArray(json.collections)) {
      console.error("[Velora] Unexpected global emote format:", json);
      return;
    }

    for (const collection of json.collections) {
      if (!collection.emotes) continue;

      for (const emote of collection.emotes) {
        if (!emote.code) continue;

        const url =
          emote.assetVariants?.static2x ||
          emote.assetVariants?.static1x ||
          null;

        if (url) {
          globalEmotes[emote.code] = url;
        }
      }
    }

    console.log("[Velora] Loaded global emotes:", Object.keys(globalEmotes).length);

  } catch (err) {
    console.error("[Velora] Failed to fetch global emotes:", err);
  }
}

// ⭐ Build lookup table
function rebuildEmoteLookup() {
  emoteLookup = { ...globalEmotes };
  console.log("[Velora] Emote lookup built:", Object.keys(emoteLookup).length);
}

// ⭐ Convert emote names → <img>
function convertVeloraEmoteNames(html) {
  if (!html) return html;

  return html.replace(/\b([A-Za-z][A-Za-z0-9]+)\b/g, (match) => {
    const url = emoteLookup[match];
    if (!url) return match;

    return `<img class="scaled-emote" src="${url}" alt="${match}">`;
  });
}

// Avatar fetcher
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
      avatarCache[username] = null;
      return null;
    }

    const data = await res.json();
    const url = data.avatarUrl || null;

    avatarCache[username] = url;
    return url;
  } catch (err) {
    console.error("[Velora] Avatar fetch error:", err);
    avatarCache[username] = null;
    return null;
  }
}

// Badge mapping
function normalizeVeloraBadges(badgesRaw, data) {
  if (!Array.isArray(badgesRaw)) return [];

  const out = [];

  for (const b of badgesRaw) {
    if (typeof b !== "string") continue;

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

    if (b === "broadcaster") {
      out.push({
        icon: "/icons/StreamerBroadcasterBadge.png",
        label: "Broadcaster",
      });
      continue;
    }

    if (b === "moderator") {
      out.push({
        icon: "https://assets.velora.tv/badges/mod.png",
        label: "Moderator",
      });
      continue;
    }

    out.push({
      icon: null,
      label: b,
    });
  }

  return out;
}

export function startVelora(broadcast) {
  console.log("Starting Velora Socket.IO ingestion…");

  // ⭐ Fetch global emotes on startup
  (async () => {
    await fetchGlobalEmotes();
    rebuildEmoteLookup();
  })();

  startVeloraSocketIO(broadcast);
}

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

  chatSocket.on("connect", async () => {
    console.log("[Velora] Socket.IO connected. id:", chatSocket.id);

    chatSocket.emit("joinChannel", {
      channelId: VELORA_CHANNEL_ID,
    });

    // ⭐ Refresh global emotes on reconnect
    await fetchGlobalEmotes();
    rebuildEmoteLookup();
  });

  chatSocket.on("connect_error", (err) => {
    console.error("[Velora] connect_error:", err.message);
  });

  chatSocket.on("disconnect", (reason) => {
    console.warn("[Velora] disconnected:", reason);
  });

  chatSocket.onAny((event, payload) => {
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

async function handleVeloraChatEvent(payload, broadcast) {
  if (!payload) return;

  if (payload.id) {
    if (seenMessageIds.has(payload.id)) return;
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

  // ⭐ Convert emote names → <img>
  html = convertVeloraEmoteNames(html);

  const badges = normalizeVeloraBadges(data.badges, data);

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

  broadcast(out);
}

async function handleVeloraRewardEvent(payload, broadcast) {
  if (!payload) return;

  const data = payload.data || payload;
  const reward = data.reward || data;

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
      }
    }
  } catch (err) {
    console.error("[Velora] Reward fetch error:", err);
  }

  const out = {
    platform: "velora",
    type: "reward",
    username: data.username || data.user?.username || null,
    rewardName: reward.name || null,
    rewardIcon: reward.icon || null,
    rewardHTML,
  };

  broadcast(out);
}
