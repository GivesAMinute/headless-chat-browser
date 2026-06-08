// sources/blaze.js
import WebSocket from "ws";
import fetch from "node-fetch";

const BLAZE_API_BASE = "https://api.blaze.stream";
const BLAZE_WS_URL = "wss://api.blaze.stream/v1/events/socket";

export function startBlaze(broadcast) {
  const channelId =
    process.env.BLAZE_CHANNEL_ID ||
    "f6b81529-8fcd-4bbe-b2b7-8f6d9c99b15f"; // your channelId as fallback

  const clientId = process.env.BLAZE_CLIENT_ID;
  const clientSecret = process.env.BLAZE_SECRET;
  let accessToken = process.env.BLAZE_ACCESS_TOKEN;

  if (!clientId || !clientSecret || !accessToken || !channelId) {
    console.error(
      "[BLAZE] Missing env vars: BLAZE_CLIENT_ID, BLAZE_SECRET, BLAZE_ACCESS_TOKEN, BLAZE_CHANNEL_ID"
    );
    return;
  }

  let ws = null;
  let sessionId = null;
  let reconnectTimer = null;

  async function subscribeToChat() {
    if (!sessionId) return;

    try {
      const res = await fetch(`${BLAZE_API_BASE}/v1/events/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "client-id": clientId,
          secret: clientSecret
        },
        body: JSON.stringify({
          type: "channel.chat.message",
          sessionId,
          condition: { channelId }
        })
      });

      const data = await res.json();
      if (!data.success) {
        console.error("[BLAZE] Failed to subscribe:", data);
      } else {
        console.log("[BLAZE] Subscribed to channel.chat.message");
      }
    } catch (err) {
      console.error("[BLAZE] Error subscribing:", err);
    }
  }

  function handleEvent(msg) {
    if (msg?.metadata?.subscriptionType === "channel.chat.message") {
      const p = msg.payload;
      if (!p || !p.sender) return;

      broadcast({
        platform: "blaze",
        username: p.sender.displayName || p.sender.username || "Unknown",
        html: p.message || "",
        avatar: p.sender.avatarUrl || null,
        badges: p.sender.roles || []
      });
    }
  }

  function connect() {
    console.log("[BLAZE] Connecting to EventSub…");

    ws = new WebSocket(BLAZE_WS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "client-id": clientId,
        secret: clientSecret
      }
    });

    ws.on("open", () => {
      console.log("[BLAZE] WebSocket connected");
    });

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // Initial session handshake
      if (msg.sessionId && !sessionId) {
        sessionId = msg.sessionId;
        console.log("[BLAZE] Session established:", sessionId);
        subscribeToChat();
        return;
      }

      handleEvent(msg);
    });

    ws.on("close", (code, reason) => {
      console.log(
        `[BLAZE] WebSocket closed (${code}): ${reason?.toString() || ""}`
      );
      sessionId = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      }
    });

    ws.on("error", (err) => {
      console.error("[BLAZE] WebSocket error:", err);
    });
  }

  connect();
}
