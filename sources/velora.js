// sources/velora.js

export async function startVelora(browser, broadcast) {
  console.log("Starting Velora scraper…");

  const page = await browser.newPage();

  await page.goto("https://velora.tv/givesaminute/chat", {
    waitUntil: "networkidle2"
  });

  await page.exposeFunction("relayVelora", (msg) => {
    broadcast(msg);
  });

  // Avatar cache to avoid repeated profile fetches
  const avatarCache = {};

  await page.exposeFunction("fetchVeloraAvatar", async (username) => {
    if (avatarCache[username]) {
      return avatarCache[username];
    }

    try {
      const profileURL = `https://velora.tv/${username}`;
      const profilePage = await browser.newPage();
      await profilePage.goto(profileURL, { waitUntil: "domcontentloaded" });

      const avatarURL = await profilePage.evaluate(() => {
        const img = document.querySelector("img.rounded-full");
        return img?.src || null;
      });

      await profilePage.close();

      if (avatarURL) {
        avatarCache[username] = avatarURL;
        return avatarURL;
      }
    } catch (err) {
      console.error("Velora avatar fetch failed:", err);
    }

    return null;
  });

  await page.evaluate(() => {
    const safe = (el, selector) => {
      try { return el.querySelector(selector) || null; }
      catch { return null; }
    };

    const safeText = (el, selector, fallback = "") => {
      const node = safe(el, selector);
      return node?.innerText?.trim() || fallback;
    };

    const observer = new MutationObserver(async () => {
      const nodes = [...document.querySelectorAll(".chat-message-content")];
      const last = nodes[nodes.length - 1];
      if (!last) return;

      // USERNAME (Velora uses a <button> element)
      let username = safeText(last, "button");
      username = username.replace(":", "").trim();

      // MESSAGE TEXT
      const msgText = safe(last, ".text-white\\/90") || last;
      const html = msgText.innerHTML || "";

      // BADGES
      const badges = [...last.querySelectorAll("img")]
        .map(img => img.src)
        .filter(src => src.includes("velora-badges") || src.includes("assets.velora.tv/badges"));

      // FETCH AVATAR
      const avatar = await window.fetchVeloraAvatar(username);

      window.relayVelora({
        platform: "velora",
        username,
        html,
        avatar,
        badges
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Velora chat observer active.");
}
