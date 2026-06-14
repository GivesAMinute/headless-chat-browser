// sources/velora.js

import WebSocket from "ws";
import fetch from "node-fetch"; // Required for reward card fetch
import { sanitizeHTML } from "../utils/sanitizeHTML.js";

export async function startVelora(browser, broadcast) {
  console.log("Starting Velora scraper…");

  const page = await browser.newPage();

  await page.goto("https://velora.tv/givesaminute/chat", {
    waitUntil: "networkidle2"
  });

  // Avatar cache
  const avatarCache = Object.create(null);

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
        console.warn("Velora API non-OK:", username, res.status);
        avatarCache[username] = null;
        return null;
      }

      const data = await res.json();
      const url = data.avatarUrl || null;

      avatarCache[username] = url;
      return url;
    } catch (err) {
      console.error("Velora avatar fetch failed:", err);
      avatarCache[username] = null;
      return null;
    }
  }

  // Relay with avatar enrichment (DOM chat path)
  await page.exposeFunction("relayVelora", async (msg) => {
    console.log("VELORA DEBUG incoming (DOM):", msg);

    const avatar = await fetchVeloraAvatar(msg.username);

    const enriched = {
      ...msg,
      avatar
    };

    console.log("VELORA DEBUG outgoing (DOM):", enriched);

    broadcast(enriched);
  });

  // Optimized Velora DOM observer: only process newly added .msg nodes
  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          // Only handle actual chat message containers
          if (!node.classList.contains("msg")) continue;

          // USERNAME
          const usernameEl = node.querySelector(".username");
          const username = usernameEl ? usernameEl.innerText.trim() : null;

          // MESSAGE HTML (raw)
          const textEl = node.querySelector(".text");
          const html = textEl ? textEl.innerHTML : "";

          // BADGES
          const badges = [...node.querySelectorAll("img")]
            .map(img => img.src)
            .filter(src =>
              src.includes("velora-badges") ||
              src.includes("assets.velora.tv/badges")
            );

          window.relayVelora({
            platform: "velora",
            username,
            html,
            badges
          });
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Velora chat observer active.");

  // ⭐ Start WebSocket for official reward events
  startVeloraWebSocket(broadcast);
}

// ⭐ Velora Chat WebSocket (official reward events + reward card fetcher)
function startVeloraWebSocket(broadcast) {
  const VELORA_TOKEN =
    process.env.VELORA_TOKEN ||
    "PASTE_YOUR_VELORA_ACCESS_TOKEN_HERE"; // <-- paste your access_token here

  const ws = new WebSocket("wss://api.velora.tv/api/chat");

  ws.on("open", () => {
    console.log("Velora WebSocket connected.");

    ws.send(JSON.stringify({
      type: "authenticate",
      token: VELORA_TOKEN
    }));
  });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // ⭐ Reward redemptions
    if (msg.type === "reward_redeemed") {
      const data = msg.data || {};
      const reward = data.reward || {};

      console.log("VELORA DEBUG incoming (WS REWARD):", msg);

      // ⭐ Fetch the REAL Velora reward card HTML
      let rewardHTML = null;

      try {
        const res = await fetch(
          `https://api.velora.tv/api/channel-points/rewards/${reward.id}`,
          {
            headers: {
              Authorization: `Bearer ${VELORA_TOKEN}`
            }
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

      // ⭐ Broadcast to overlay
      const payload = {
        platform: "velora",
        type: "reward",
        username: data.username || null,
        rewardName: reward.name || null,
        rewardIcon: reward.icon || null,
        rewardHTML
      };

      console.log("VELORA DEBUG outgoing (WS REWARD):", payload);
      broadcast(payload);
      return;
    }

    // Ignore other WS messages (DOM scraper handles chat)
  });

  ws.on("close", () => {
    console.log("Velora WebSocket disconnected. Reconnecting in 5s…");
    setTimeout(() => startVeloraWebSocket(broadcast), 5000);
  });

  ws.on("error", (err) => {
    console.error("Velora WebSocket error:", err);
  });
}
