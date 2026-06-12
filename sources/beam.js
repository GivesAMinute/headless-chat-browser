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
    const observer = new MutationObserver(() => {
      const nodes = [...document.querySelectorAll(".chat-message")];
      const last = nodes[nodes.length - 1];
      if (!last) return;

      /* USERNAME */
      const username =
        last.querySelector(".username")?.innerText?.trim() ||
        last.querySelector(".user-name")?.innerText?.trim() ||
        "Unknown";

      /* AVATAR */
      const avatar =
        last.querySelector(".avatar img")?.src ||
        last.querySelector("img.avatar")?.src ||
        null;

      /* BADGES */
      const badges = [...last.querySelectorAll(".badge img")].map(img => img.src);

      /* MESSAGE HTML */
      const container =
        last.querySelector(".message") ||
        last.querySelector(".msg-body") ||
        last;

      let html = "";
      if (container) {
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

            if (el.tagName === "VIDEO") {
              return el.outerHTML;
            }

            return el.outerHTML || el.textContent || "";
          })
          .join("");
      }

      /* STICKERS (Beam uses <img class="sticker"> or <video>) */
      const sticker = last.querySelector("img.sticker, video.sticker");
      const stickerHTML = sticker ? sticker.outerHTML : "";

      /* SEND NORMALIZED MESSAGE */
      window.relayBeam({
        platform: "beam",   // ⭐ NORMALIZED — required for V3.2
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

