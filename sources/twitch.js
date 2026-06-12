// sources/twitch.js

export async function startTwitchChat(browser, broadcast) {
  console.log("Starting Twitch scraper…");

  const page = await browser.newPage();

  await page.goto(
    "https://www.twitch.tv/popout/givesaminute/chat?popout=",
    { waitUntil: "networkidle2" }
  );

  const pendingByUser = new Map();

  await page.exposeFunction("relayTwitch", (msg) => {
    const username = msg.username || "Unknown";
    const key = username.toLowerCase();

    const existing = pendingByUser.get(key);
    if (existing && existing.timer) {
      clearTimeout(existing.timer);
    }

    const payload = {
      platform: "twitch",
      username: msg.username,
      html: msg.html,
      avatar: msg.avatar,
      badges: msg.badges
    };

    const timer = setTimeout(() => {
      console.log("TWITCH → FINAL MESSAGE SENT:", payload);
      broadcast(payload);
      pendingByUser.delete(key);
    }, 500);

    pendingByUser.set(key, { timer, msg: payload });
  });

  await page.evaluate(() => {
    let twitchDebounce = null;

    const observer = new MutationObserver(() => {
      clearTimeout(twitchDebounce);

      twitchDebounce = setTimeout(() => {
        const lines = [...document.querySelectorAll(".chat-line__message")];
        const last = lines[lines.length - 1];
        if (!last) return;

        const username =
          last.querySelector(".chat-author__display-name")?.innerText?.trim() ||
          "Unknown";

        const avatar =
          last.querySelector(".chat-badge-avatar img")?.src ||
          null;

        const badges = [...last.querySelectorAll(".chat-badge")].map(
          (b) => b.querySelector("img")?.src
        );

        const container =
          last.querySelector(".message") || last;

        let html = "";

        if (container) {
          const parts = [
            ...container.querySelectorAll(".text-fragment, .chat-image")
          ];

          html = parts
            .map((el) => {
              if (el.classList.contains("text-fragment")) {
                return el.outerHTML || el.textContent || "";
              }

              if (el.classList.contains("chat-image")) {
                const img = el.querySelector("img") || el;
                const alt = (img.getAttribute("alt") || "").trim();
                if (!alt) return "";
                return el.outerHTML || "";
              }

              return "";
            })
            .join("");
        }

        window.relayTwitch({
          username,
          html,
          avatar,
          badges
        });
      }, 120);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Twitch chat observer active.");
}
