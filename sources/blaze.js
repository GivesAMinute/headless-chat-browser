// sources/blaze.js
import WebSocket from "ws";

export function startBlaze(broadcast, channelName) {
  let ws;

  function connect() {
    ws = new WebSocket("wss://api.blaze.stream/socket");

    ws.on("open", () => {
      console.log("🔥 Blaze connected. Joining room:", channelName);

      ws.send(JSON.stringify({
        action: "join",
        room: channelName,
        token: null // guest mode works
      }));
    });

    ws.on("message", raw => {
      let data;
      try { data = JSON.parse(raw); } catch { return; }

      // Blaze sometimes wraps messages inside { event, data }
      const msg = data.data || data;

      if (msg.type !== "message") return;

      broadcast({
        platform: "blaze",
        username: msg.user?.name || "Unknown",
        html: msg.content || "",
        avatar: msg.user?.avatar || null,
        badges: [] // Blaze doesn't expose badges yet
      });
    });

    ws.on("close", () => {
      console.log("🔥 Blaze disconnected. Reconnecting in 3s…");
      setTimeout(connect, 3000);
    });

    ws.on("error", (err) => {
      console.log("🔥 Blaze error:", err);
      ws.close();
    });
  }

  connect();
}
