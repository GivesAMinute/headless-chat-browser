// sources/beam.js
import puppeteer from "puppeteer";

export async function startBeamScraper({ browser, broadcast }) {
  console.log("Starting Beam scraper…");

  const page = await browser.newPage();

  page.on("console", (msg) => console.log("BEAM LOG:", msg.text()));

  console.log("Injecting Beam login session…");

  await page.goto("https://beamstream.gg", { waitUntil: "domcontentloaded" });

  const storage = JSON.parse(process.env.BEAM_LOCALSTORAGE);

  await page.evaluate((storage) => {
    for (const [key, value] of Object.entries(storage)) {
      localStorage.setItem(key, value);
    }
  }, storage);

  console.log("Beam session injected. Loading chat…");

  await page.goto("https://beamstream.gg/givesaminute/chat", {
    waitUntil: "networkidle2"
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("Injecting Beam message observer…");

  await page.exposeFunction("relayMessage", (msg) => {
    broadcast(msg);
  });

  await page.evaluate(() => {
    const selector =
      'div[typeof="ChatMessage"], div[typeof="ChatMessageExternal"]';

    const observer = new MutationObserver(() => {
      const messages = [...document.querySelectorAll(selector)];
      const last = messages[messages.length - 1];
      if (!last) return;

      let platform =
        last.querySelector('[property="service"]')?.getAttribute("value") ||
        "beam";

      if (platform === "twitch" || platform === "velora") return;

      const username =
        last.querySelector('[property="sender.name"]')?.innerText?.trim() || "";

      let html =
        last.querySelector('[property="body"]')?.innerHTML || "";

      const avatar =
        last.querySelector('[property="avatar"]')?.src || null;

      const badges = [
        ...last.querySelectorAll('[property="badge"]'),
        ...last.querySelectorAll('img[class*="badge"]'),
        ...last.querySelectorAll('img[data-badge]')
      ].map(b => b.src);

      let stickerHTML = "";
      const sticker = last.querySelector("video");
      if (sticker) {
        stickerHTML = sticker.outerHTML;
      }

      window.relayMessage({
        platform,
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
