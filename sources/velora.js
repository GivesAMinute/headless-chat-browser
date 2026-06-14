// sources/velora.js
// Velora WebSocket-only integration
// - Chat via WS
// - Rewards via WS + HTML fetch
// - Avatar enrichment
// - Badge caching
// - Emote-safe HTML passthrough
// - Message type tagging
// - Full debug logging

import WebSocket from "ws";

// ⭐ IMPORTANT: Paste your real Velora token here
const VELORA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZjFjYjk3NS1lYWNlLTQ2NTAtODI0Ni0wNTMwMDdiZDAwMzYiLCJ1c2VybmFtZSI6IkdpdmVzQU1pbnV0ZSIsImVtYWlsIjoiYmVub25rb2Vic2NoQGdtYWlsLmNvbSIsInJvbGUiOiJjcmVhdG9yIiwiaWF0IjoxNzgxMzg2NDk2LCJleHAiOjE3ODE5OTEyOTYsImF1ZCI6InZlbG9yYS1hcGkiLCJpc3MiOiJ2ZWxvcmEudHYifQ.AUDMnQ7AeJMfobcOiGjBSLSx5X0aOqRwdsDS_ROTWZg";

// Avatar cache
const avatarCache = Object.create(null);

// Badge cache
const badgeCache = Object.create(null);

export function startVelora(broadcast) {
  console.log("Starting Velora WebSocket ingestion…");
  startVeloraWebSocket(broadcast);
}

// Fetch avatar
async function fetchVeloraAvatar(username) {
  if (!username) return null;

  if (avatarCache[username]) return avatarCache[username];

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

// Normalize badges
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

// MAIN WS HANDLER
function startVeloraWebSocket(broadcast) {
  console.log("Connecting to Velora WebSocket…");

  const ws = new WebSocket("wss://api.velora.tv/api/chat");

  ws.on("open", () => {
    console.log("Velora WebSocket connected. Sending auth…");

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
      console.warn("Velora WS: Received non-JSON message");
      return;
    }

    console.log("Velora WS RAW:", msg);

    // AUTH RESPONSE
    if (msg.type === "authenticated") {
      console.log("Velora WS: Authentication successful");
      return;
    }

    if (msg.type === "authentication_failed") {
      console.error("Velora WS: Authentication FAILED");
      return;
    }

    // CHAT MESSAGE
    if (msg.type === "message") {
      const data = msg.data || {};

      const username = data.username || null;
      const html = data.message_html || "";
      const badges = normalizeVeloraBadges(data.badges || []);
      const messageType = mapVeloraMessageType(data);
      const avatar = await fetchVeloraAvatar(username);

      const payload = {
        platform: "velora",
        username,
        html,
        badges,
        avatar,
        messageType,
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

  ws.on("close", (code) => {
    console.warn("Velora WebSocket closed:", code);
    console.log("Reconnecting in 5s…");
    setTimeout(() => startVeloraWebSocket(broadcast), 5000);
  });

  ws.on("error", (err) => {
    console.error("Velora WebSocket error:", err);
  });
}
