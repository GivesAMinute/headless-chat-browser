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
    const safe = (el, selector, fallback = null) => {
      try {
        const found = el.querySelector(selector);
        return found ? found : fallback;
      } catch {
        return fallback;
      }
    };

    const safeText = (el, selector, fallback = "") => {
      const node = safe(el, selector);
      return node?.innerText?.trim() || fallback;
    };

    const safeSrc = (el, selector) => {
      const node = safe(el, selector);
      const src = node?.src || null;
      return typeof src === "string" && src.startsWith("http") ? src : null;
    };

    const observer = new MutationObserver(() => {
      const nodes = [...document.querySelectorAll(".chat-message")];
      const last = nodes[nodes.length - 1];
      if (!last) return;

      const username = safeText(last, ".username", "Unknown");

      const avatar =
        safeSrc(last, ".avatar img") ||
        safeSrc(last, "img.avatar") ||
        null;

      const badges = [...last.querySelectorAll(".badge img")]
        .map(img => img.src)
        .filter(src => typeof src === "string");

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

      const sticker = safe(last, "img.sticker, video.sticker");
      const stickerHTML = sticker ? sticker.outerHTML : "";

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
