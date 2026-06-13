// sources/velora.js

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

    if (avatarCache[username]) {
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

  // Relay with avatar enrichment
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

  // Correct Velora DOM observer
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const nodes = [...document.querySelectorAll(".msg")];
      const last = nodes[nodes.length - 1];
      if (!last) return;

      // USERNAME
      const usernameEl = last.querySelector(".username");
      const username = usernameEl ? usernameEl.innerText.trim() : null;

      // MESSAGE HTML
      const textEl = last.querySelector(".text");
      const html = textEl ? textEl.innerHTML : "";

      // BADGES
      const badges = [...last.querySelectorAll("img")]
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
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Velora chat observer active.");
}
