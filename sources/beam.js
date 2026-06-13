// sources/beam.js

export async function startBeam(browser, broadcast) {
  console.log("Starting Beam scraper…");

  const page = await browser.newPage();

  await page.goto(
    "https://beamstream.gg/givesaminute/chat",
    { waitUntil: "networkidle2" }
  );

  await page.exposeFunction("relayBeam", (msg) => {
    broadcast(msg);
  });

  await page.evaluate(() => {

    /* ---------- SAFE HELPERS ---------- */

    const safe = (el, selector) => {
      try {
        return el.querySelector(selector) || null;
      } catch {
        return null;
      }
    };

    const safeText = (el, selector, fallback = "") => {
      const node = safe(el, selector);
      return node?.innerText?.trim() || fallback;
    };

    const safeSrc = (el, selector) => {
      const node = safe(el, selector);
      const src = node?.src || null;
      return (typeof src === "string" && src.startsWith("http")) ? src : null;
    };

    /* ---------- OBSERVER ---------- */

    const observer = new MutationObserver(() => {
      const nodes = [...document.querySelectorAll(".chat-message")];
      const last = nodes[nodes.length - 1];
      if (!last) return;

      /* ---------- USERNAME ---------- */
      const username =
        safeText(last, ".username") ||
        safeText(last, ".user-name") ||
        "Unknown";

      /* ---------- AVATAR (bulletproof) ---------- */
      let avatar = null;

      const avatarSelectors = [
        ".avatar img",
        "img.avatar",
        "img.user-avatar",
        "img[src*='profile']",
        "img[src*='avatar']"
      ];

      for (const sel of avatarSelectors) {
        const found = safeSrc(last, sel);
        if (found) {
          avatar = found;
          break;
        }
      }

      if (!avatar) avatar = null;

      /* ---------- BADGES ---------- */
      const badges = [...last.querySelectorAll(".badge img")]
        .map(img => img.src)
        .filter(src => typeof src === "string");

      /* ---------- MESSAGE HTML ---------- */
      const container =
        safe(last, ".message") ||
        safe(last, ".msg-body") ||
        last;

      let html = "";
      try {
        const parts = [
          ...container.querySelectorAll(".text-fragment, .chat-image, img, video")
        ];

        html = parts
          .map(el => {
            if (el.tagName === "IMG") {
              const alt = (el.getAttribute("alt") || "").trim();
              if (!alt) return "";
              return el.outerHTML;
            }
            if (el.tagName === "VIDEO") return el.outerHTML;
            return el.outerHTML || el.textContent || "";
          })
          .join("");
      } catch {
        html = container?.innerText || "";
      }

      /* ---------- STICKERS ---------- */
      const sticker = safe(last, "img.sticker, video.sticker");
      const stickerHTML = sticker ? sticker.outerHTML : "";

      /* ---------- SEND MESSAGE ---------- */
      window.relayBeam({
        platform: "beam",
        username,
        html: html + stickerHTML,
        avatar,
        badges
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Beam chat observer active.");
}
