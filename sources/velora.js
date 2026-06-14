// sources/velora.js
// Velora WebSocket-only integration
// - Chat via WS
// - Rewards via WS + HTML fetch
// - Avatar enrichment
// - Badge caching
// - Emote-safe HTML passthrough
// - Message type tagging

import WebSocket from "ws";

// Node 18+ has global fetch

export function startVelora(broadcast) {
  console.log("Starting Velora WebSocket ingestion…");
  startVeloraWebSocket(broadcast);
}

// Avatar cache
const avatarCache = Object.create(null);

// Badge cache (by badge ID or icon URL)
const badgeCache = Object.create(null);

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

// Normalize badges from WS payload into simple icon URLs
function normalizeVeloraBadges(badgesRaw) {
  if (!Array.isArray(badgesRaw)) return [];

  return badgesRaw
    .map((b) => {
      // Velora WS usually sends { id, name, icon }
      if (!b) return null;

      const key = b.id || b.icon || JSON.stringify(b);

      if (badgeCache[key]) {
        return badgeCache[key];
      }

      const icon = b.icon || null;
      if (!icon) return null;

      badgeCache[key] = icon;
      return icon;
    })
    .filter(Boolean);
}

// Map Velora WS message subtype to a simple type tag
function mapVeloraMessageType(data) {
  // If Velora ever sends explicit types, map them here.
  // For now we just distinguish normal vs system vs action if present.
  if (!data) return "chat";

  if (data.is_action) return "action";
  if (data.is_system) return "system";

  return "chat";
}

// MAIN WS HANDLER
function startVeloraWebSocket(broadcast) {
  const VELORA_TOKEN =
    process.env.VELORA_TOKEN ||
    "PASTE_YOUR_VELORA_ACCESS_TOKEN_HERE"; // <-- paste your token

  const ws = new WebSocket("wss://api.velora.tv/api/chat");

  ws.on("open", () => {
    console.log("Velora WebSocket connected.");

    ws.send(
      JSON.stringify({
        type: "authenticate",
        token: VELORA_TOKEN,
      })
    );
  });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // CHAT MESSAGE
    if (msg.type === "message") {
      const data = msg.data || {};

      const username = data.username || null;

      // EXACT mapping: keep Velora's HTML (with emotes) as-is
      const html = data.message_html || "";

      // Badge normalization + caching
      const badges = normalizeVeloraBadges(data.badges || []);

      // Optional: message type tagging (for future coloring)
      const messageType = mapVeloraMessageType(data);

      const avatar = await fetchVeloraAvatar(username);

      const payload = {
        platform: "velora",
        username,
        html,          // emotes preserved
        badges,        // cached icons
        avatar,
        messageType,   // "chat" | "action" | "system" (if present)
      };

      console.log("VELORA WS CHAT:", payload);
      broadcast(payload);
      return;
    }

    // REWARD REDEMPTION
    if (msg.type === "reward_redeemed") {
      const data = msg.data || {};
      const reward = data.reward || {};

      console.log("VELORA WS REWARD IN:", msg);

      // Fetch REAL Velora reward card HTML
      let rewardHTML = null;

      try {
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
          console.warn("Velora reward fetch failed:", res.status);
        }
      } catch (err) {
        console.error("Velora reward fetch error:", err);
      }

      const payload = {
        platform: "velora",
        type: "reward",
        username: data.username || null,
        rewardName: reward.name || null,
        rewardIcon: reward.icon || null,
        rewardHTML,
      };

      console.log("VELORA WS REWARD OUT:", payload);
      broadcast(payload);
      return;
    }
  });

  ws.on("close", () => {
    console.log("Velora WebSocket disconnected. Reconnecting in 5s…");
    setTimeout(() => startVeloraWebSocket(broadcast), 5000);
  });

  ws.on("error", (err) => {
    console.error("Velora WebSocket error:", err);
  });
}
