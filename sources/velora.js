// sources/velora.js

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

  // Relay with avatar enrichment + backend sanitization + reward support
  await page.exposeFunction("relayVelora", async (msg) => {
    console.log("VELORA DEBUG incoming:", msg);

    // ⭐ Reward card path
    if (msg.type === "reward") {
      const enrichedReward = {
        platform: "velora",
        type: "reward",
        rewardHTML: msg.rewardHTML,
        username: msg.username,
        rewardName: msg.rewardName,
        rewardIcon: msg.rewardIcon
      };

      console.log("VELORA DEBUG outgoing REWARD:", enrichedReward);
      broadcast(enrichedReward);
      return;
    }

    // ⭐ Normal chat message path
    const avatar = await fetchVeloraAvatar(msg.username);

    const enriched = {
      ...msg,
      avatar,
      safeHtml: sanitizeHTML(msg.safeHtml)
    };

    console.log("VELORA DEBUG outgoing CHAT:", enriched);
    broadcast(enriched);
  });

  // Optimized Velora DOM observer: process .msg AND reward cards
  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          // ⭐ Detect reward cards (full wrapper)
          if (node.classList.contains("mx-1") && node.classList.contains("my-1.5")) {
            const rewardHTML = node.outerHTML;

            // Username
            const usernameEl = node.querySelector(".animate-[glow_2s_ease-in-out_infinite]");
            const username = usernameEl
              ? usernameEl.innerText.replace(":", "").trim()
              : null;

            // Reward name
            const rewardNameEl = node.querySelector(".animate-pulse span");
            const rewardName = rewardNameEl ? rewardNameEl.innerText.trim() : null;

            // Reward icon (SVG or IMG)
            const iconEl = node.querySelector(".flex.h-12.w-12 svg, .flex.h-12.w-12 img");
            const rewardIcon = iconEl ? iconEl.outerHTML : null;

            window.relayVelora({
              platform: "velora",
              type: "reward",
              rewardHTML,
              username,
              rewardName,
              rewardIcon
            });

            continue; // Prevent falling through to normal chat logic
          }

          // ⭐ Normal chat messages
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

          // Send safeHtml (sanitized on Node side)
          window.relayVelora({
            platform: "velora",
            username,
            safeHtml: html,
            badges
          });
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Velora chat observer active.");
}
