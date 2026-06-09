import axios from "axios";

/* ---------------------------------------------------------
   ⭐ Extract message text from any Blaze message shape
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   ⭐ BlazePoller — polls Blaze chat every X ms
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   ⭐ Normalize Blaze → overlay format
--------------------------------------------------------- */
function transformBlazeMessage(msg) {
  const sender = msg.sender || msg.user || {};

  return {
    platform: "blaze",
    id: msg.id,
    username: sender.displayName || sender.username || "Unknown",
    avatar: sender.avatarUrl || null,
    badges: sender.roles || [],
    html: extractMessage(msg),
    timestamp: msg.timestamp || msg.createdAt || Date.now()
  };
}

/* ---------------------------------------------------------
   ⭐ startBlaze — used by index.js
--------------------------------------------------------- */
export function startBlaze(broadcast) {
  const channelId = process.env.BLAZE_CHANNEL_ID;
  const clientId = process.env.BLAZE_CLIENT_ID;
  const accessToken = process.env.BLAZE_ACCESS_TOKEN;

  if (!clientId || !accessToken) {
    console.error("[BLAZE] Missing BLAZE_CLIENT_ID or BLAZE_ACCESS_TOKEN");
    return;
  }

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
  console.log("[BLAZE] Poller started");
}
