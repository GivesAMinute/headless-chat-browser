// sources/blaze.js
import axios from "axios";

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

    if (this.lastSeenIds.size > 1000) {
      const ids = Array.from(this.lastSeenIds).slice(-500);
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
      console.error("[BLAZE] Poll error:", err.message);
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
   ⭐ startBlaze — wrapper used by index.js
--------------------------------------------------------- */
export function startBlaze(broadcast) {
  const channelId =
    process.env.BLAZE_CHANNEL_ID ||
    "f6b81529-8fcd-4bbe-b2b7-8f6d9c99b15f";

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
      for (const msg of messages) {
        const sender = msg.sender || msg.user || {};

        broadcast({
          platform: "blaze",
          username:
            sender.displayName ||
            sender.username ||
            sender.name ||
            "Unknown",
          html: msg.message || msg.content || "",
          avatar: sender.avatarUrl || sender.avatar || null,
          badges: sender.roles || sender.badges || []
        });
      }
    }
  });

  poller.start();
  console.log("[BLAZE] Poller started");
}
