// sources/velora.js

export async function startVelora(browser, broadcast) {
  console.log("Starting Velora scraper…");

  const page = await browser.newPage();

  await page.goto(
    "https://velora.live/givesaminute/chat",
    { waitUntil: "networkidle2" }
  );

  await page.exposeFunction("relayVelora", (msg) => {
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
        "Unknown";

      /* AVATAR (safe + async friendly) */
      let avatar =
        last.querySelector(".avatar img")?.src ||
        last.querySelector("img.avatar")?.src ||
        null;

      if (!avatar || typeof avatar !== "string" || !avatar.startsWith("http")) {
        avatar = null;
      }

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

      /* STICKERS */
      const sticker = last.querySelector("img.sticker, video.sticker");
      const stickerHTML = sticker ? sticker.outerHTML : "";

      /* SEND NORMALIZED MESSAGE */
      window.relayVelora({
        platform: "velora",
        username,
        html: html + stickerHTML,
        avatar,
        badges
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Velora chat observer active.");
}
