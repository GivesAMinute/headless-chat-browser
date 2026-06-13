// sources/velora.js

export async function startVelora(browser, broadcast) {
  console.log("Starting Velora scraper…");

  const page = await browser.newPage();

  // TODO: if you ever change channel, make this dynamic
  await page.goto("https://velora.tv/givesaminute/chat", {
    waitUntil: "networkidle2"
  });

  // Simple in-memory avatar cache
  const avatarCache = Object.create(null);

  async function fetchVeloraAvatar(username) {
    if (!username) return null;

    // Use cache if we already looked this user up
    if (avatarCache[username]) {
      return avatarCache[username];
    }

    try {
      const res = await fetch(`https://velora.tv/api/users/${encodeURIComponent(username)}`);
      if (!res.ok) {
        console.warn("Velora avatar API non-OK for", username, res.status);
        avatarCache[username] = null;
        return null;
      }

      const data = await res.json();
      const url = data.avatarUrl || null;

      avatarCache[username] = url || null;
      return url || null;
    } catch (err) {
      console.error("Velora avatar fetch failed for", username, err);
      avatarCache[username] = null;
      return null;
    }
  }

  // Expose a relay that enriches messages with avatar before broadcasting
  await page.exposeFunction("relayVelora", async (msg) => {
  console.log("VELORA DEBUG:", msg);   // <— ADD THIS
  const avatar = await fetchVeloraAvatar(msg.username);
  broadcast({ ...msg, avatar });
});

    } catch (err) {
      console.error("relayVelora error:", err);
      broadcast(msg);
    }
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

    const observer = new MutationObserver(() => {
      const nodes = [...document.querySelectorAll(".chat-message-content")];
      const last = nodes[nodes.length - 1];
      if (!last) return;

      // USERNAME (Velora uses a <button> element with "Name:")
      let username = safeText(last, "button");
      username = username.replace(/:$/, "").trim();

      // MESSAGE TEXT (Velora uses span.text-white/90)
      const msgNode =
        safe(last, "span.text-white\\/90") ||
        safe(last, "span.text-white") ||
        last;

      const html = msgNode.innerHTML || "";

      // BADGES (Velora badges live in img elements before the username)
      const badges = [...last.querySelectorAll("img")]
        .map(img => img.src)
        .filter(src =>
          typeof src === "string" &&
          (src.includes("velora-badges") || src.includes("assets.velora.tv/badges"))
        );

      // Send minimal payload; Node side will add avatar
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
