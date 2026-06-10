// sources/blaze.js
import axios from "axios";
import { io } from "socket.io-client";

function extractMessage(msg) {
  if (msg.message) return msg.message;
  if (msg.content) return msg.content;
  if (msg.text) return msg.text;

  const parts = msg.parts || msg.fragments || msg.contentParts || [];
  if (parts.length > 0) {
    return parts
      .map((p) => {
        if (p.type === "text") return p.text;
        if (p.type === "emote") return `<img src="${p.url}" class="emote" />`;
        if (p.type === "sticker") return `<img src="${p.url}" class="sticker" />`;
        return "";
      })
      .join("");
  }

  return "";
}

function normalizeSender(msg) {
  let sender = {};

  try {
    const raw = JSON.stringify(msg);
    const match = raw.match(/"sender":\s*({[^}]+})/);
    if (match) sender = JSON.parse(match[1]);
  } catch {}

  sender =
    sender ||
    msg.sender?.sender ||
    msg.sender?.user ||
    msg.sender ||
    msg.user ||
    msg.author ||
    {};

  return sender;
}

function transformBlazeMessage(msg) {
  const sender = normalizeSender(msg);
  const roles = sender.roles || [];

  const CHANNEL_OWNER_ID = process.env.BLAZE_OWNER_ID;

  return {
    platform: "blaze",
    id: msg.id,
    username: sender.displayName || sender.username || sender.slug || "Unknown",
    avatar: sender.avatarUrl || null,
    html: extractMessage(msg),

    // ⭐ Blaze role flags
    isStreamer: String(sender.id) === String(CHANNEL_OWNER_ID),
    isMod: roles.includes("moderator"),
    isOG: roles.includes("og"),
    isVIP: roles.includes("vip"),

    timestamp: msg.timestamp || msg.createdAt || Date.now()
  };
}

class BlazePoller {
  constructor({ channelId, clientId, accessToken, intervalMs = 1000, onMessages }) {
    this.channelId = channelId;
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.intervalMs = intervalMs;
    this.onMessages = onMessages;
    this.timer = null;
    this.running = false;
    this.lastSeenIds = new Set();
  }

  async _fetchMessages() {
    const url = "https://api.blaze.stream/v1/chats/messages";

    const res = await axios.get(url, {
      headers: {
        "client-id": this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json"
      },
      params: {
        channelId: this.channelId,
        limit: 50
      }
    });

    return res.data?.data?.messages || [];
  }

  _filterNew(messages) {
    const fresh = [];

    for (const msg of messages) {
      if (!this.lastSeenIds.has(msg.id)) {
        fresh.push(msg);
        this.lastSeenIds.add(msg.id);
      }
    }

    if (this.lastSeenIds.size > 2000) {
      const ids = Array.from(this.lastSeenIds).slice(-1000);
      this.lastSeenIds = new Set(ids);
    }

    return fresh;
  }

  async _tick() {
    if (!this.running) return;

    try {
      const messages = await this._fetchMessages();
      const newOnes = this._filterNew(messages);

      if (newOnes.length && this.onMessages) {
        this.onMessages(newOnes);
      }
    } catch (err) {
      console.error("[BLAZE] Poll error:", err?.response?.data || err.message);
    }

    if (this.running) {
      this.timer = setTimeout(() => this._tick(), this.intervalMs);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._tick();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }
}

function startBlazeEventSub(broadcast) {
  const channelId = process.env.BLAZE_CHANNEL_ID;
  const clientId = process.env.BLAZE_CLIENT_ID;
  const accessToken = process.env.BLAZE_ACCESS_TOKEN;

  const socket = io("https://blaze.stream", {
    path: "/ws",
    transports: ["websocket"],
    auth: {
      token: accessToken,
      "client-id": clientId
    }
  });

  socket.on("session_welcome", async ({ sessionId }) => {
    const subs = [
      "channel.chat.message",
      "channel.chat.message_delete",
      "channel.chat.clear",
      "channel.ban",
      "channel.unban",
      "channel.follow",
      "channel.subscribe",
      "channel.subscription.gift",
      "channel.raid"
    ];

    for (const type of subs) {
      try {
        await axios.post(
          "https://api.blaze.stream/v1/events/subscriptions",
          {
            type,
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
      } catch (err) {
        console.error("[BLAZE] Subscription error:", type, err.response?.data || err.message);
      }
    }
  });

  socket.on("eventsub", ({ metadata, payload }) => {
    if (!metadata || !metadata.subscriptionType) return;

    if (metadata.subscriptionType === "channel.chat.message") {
      const sender = payload.user || {};
      const roles = sender.roles || [];

      broadcast({
        platform: "blaze",
        id: payload.id,
        username: sender.displayName || sender.username,
        avatar: sender.avatarUrl,
        html: extractMessage(payload),

        isStreamer: sender.isOwner === true,
        isMod: roles.includes("moderator"),
        isOG: roles.includes("og"),
        isVIP: roles.includes("vip"),

        timestamp: payload.createdAt
      });

      return;
    }
  });
}

export function startBlaze(broadcast) {
  const channelId = process.env.BLAZE_CHANNEL_ID;
  const clientId = process.env.BLAZE_CLIENT_ID;
  const accessToken = process.env.BLAZE_ACCESS_TOKEN;

  const poller = new BlazePoller({
    channelId,
    clientId,
    accessToken,
    intervalMs: 1000,
    onMessages: (messages) => {
      for (const raw of messages) {
        const normalized = transformBlazeMessage(raw);
        broadcast(normalized);
      }
    }
  });

  poller.start();
  startBlazeEventSub(broadcast);
}
