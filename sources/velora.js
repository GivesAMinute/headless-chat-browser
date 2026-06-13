// sources/velora.js

export async function startVelora(browser, broadcast) {
  console.log("Starting Velora scraper…");

  const page = await browser.newPage();

  // TODO: change this if your channel changes
  await page.goto("https://velora.tv/givesaminute/chat", {
    waitUntil: "networkidle2"
  });

  // Avatar cache to avoid repeated API calls
  const avatarCache = Object.create(null);

  async function fetchVeloraAvatar(username) {
    if (!username) return null;

    // Use cache if available
    if (avatarCache[username]) {
      return avatarCache[username];
    }

    try {
      const res = await fetch(
        `https://velora.tv/api/users/${encodeURIComponent(username)}`
      );

      if (!res.ok) {
        console.warn("Velora API returned non-OK for", username, res.status);
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

  // Relay function that enriches message with avatar before broadcasting
  await page.exposeFunction("relayVelora", async (msg) => {
    console.log("VELORA DEBUG (incoming from page):", msg);

    const avatar = await fetchVeloraAvatar(msg.username);

    const enriched = {
      ...msg,
      avatar
    };

    console.log("VELORA DEBUG (outgoing to overlay):", enriched);

    broadcast(enriched);
  });

  // DOM observer inside Velora chat page
  await page.evaluate(() => {
  const observer = new MutationObserver(() => {
    const nodes = [...document.querySelectorAll(".msg")];
    const last = nodes[nodes.length - 1];
    if (!last) return;

    // USERNAME
    const usernameEl = last.querySelector(".username");
    let username = usernameEl ? usernameEl.innerText.trim() : null;

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

      // USERNAME (Velora uses <button>GivesAMinute:</button>)
      let username = safeText(last, "button");
      username = username.replace(/:$/, "").trim();

      // MESSAGE TEXT
      const msgNode =
        safe(last, "span.text-white\\/90") ||
        safe(last, "span.text-white") ||
        last;

      const html = msgNode.innerHTML || "";

      // BADGES
      const badges = [...last.querySelectorAll("img")]
        .map(img => img.src)
        .filter(src =>
          typeof src === "string" &&
          (src.includes("velora-badges") || src.includes("assets.velora.tv/badges"))
        );

      // Send minimal payload — backend will add avatar
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
