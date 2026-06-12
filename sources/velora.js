// sources/velora.js

export async function startVeloraChat(browser, broadcast) {
  console.log("Starting Velora chat scraper…");

  const veloraPage = await browser.newPage();

  await veloraPage.goto(
    "https://velora.tv/dashboard/stream/popout?panels=chat%2Cactivity&channel=GivesAMinute&layout=vertical",
    { waitUntil: "networkidle2" }
  );

  await veloraPage.exposeFunction("relayVelora", (msg) => {
    broadcast(msg);
  });

  await veloraPage.evaluate(() => {
    const observer = new MutationObserver(() => {
      const nodes = [...document.querySelectorAll(".chat-message-content")];
      const last = nodes[nodes.length - 1];
      if (!last) return;

      const wrapperSpan = last.querySelector("span.inline.leading-relaxed.text-sm");
      if (!wrapperSpan) return;

      const button = wrapperSpan.querySelector("button");
      const username = (button?.innerText || "").replace(":", "").trim();
      if (!username) return;

      const messageSpan =
        wrapperSpan.querySelector("span.break-words") ||
        wrapperSpan.querySelector("span.text-white\\/90.break-words") ||
        wrapperSpan.querySelector("span.text-white\\/90");

      const html = messageSpan?.innerHTML || "";

      const badges = [
        ...wrapperSpan.querySelectorAll('img[src*="velora-badges"]'),
        ...wrapperSpan.querySelectorAll('img[src*="assets.velora.tv/badges"]')
      ]
        .map(img => img.src)
        .filter(src => !src.includes("/base/")); // remove internal badges

      window.relayVelora({
        platform: "velora",
        username,
        html,
        avatar: null,
        badges
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Velora chat observer active.");
}
