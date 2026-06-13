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

  // Relay with avatar enrichment + backend sanitization
  await page.exposeFunction("relayVelora", async (msg) => {
    console.log("VELORA DEBUG incoming:", msg);

    const avatar = await fetchVeloraAvatar(msg.username);

    const enriched = {
      ...msg,
      avatar
    };

    console.log("VELORA DEBUG outgoing:", enriched);

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

          // ⭐ Send safeHtml instead of html
          window.relayVelora({
            platform: "velora",
            username,
            safeHtml: html,   // sanitized on Node side
            badges
          });
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Velora chat observer active.");
}
