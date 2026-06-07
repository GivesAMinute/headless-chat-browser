import express from "express";
import puppeteer from "puppeteer";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { startYouTube } from "./sources/youtube.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

app.use("/icons", express.static(path.join(__dirname, "public/icons")));

let browser;
let page;

const wss = new WebSocketServer({ noServer: true });

function broadcast(msg) {
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(msg));
    }
  }
}

async function startBrowser() {
  console.log("Launching headless browser…");

  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer"
    ]
  });

  page = await browser.newPage();

  page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));

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

  console.log("Injecting message observer…");

  await page.exposeFunction("relayMessage", (msg) => {
    console.log("New chat message:", msg);
    broadcast(msg);
  });

  await page.evaluate(() => {
    const selector =
      'div[typeof="ChatMessage"], div[typeof="ChatMessageExternal"]';

    const observer = new MutationObserver(() => {
      const messages = [...document.querySelectorAll(selector)];
      const last = messages[messages.length - 1];
      if (!last) return;

      const username =
        last.querySelector('[property="sender.name"]')?.innerText?.trim() || "";

      const html =
        last.querySelector('[property="body"]')?.innerHTML || "";

      const avatar =
        last.querySelector('[property="avatar"]')?.src || null;

      const badges = [...last.querySelectorAll('[property="badge"]')].map(
        (b) => b.src
      );

      // ⭐ NEW: Capture Beam stickers (video elements)
      let stickerHTML = "";
      const sticker = last.querySelector("video");
      if (sticker) {
        stickerHTML = sticker.outerHTML;
      }

      let platform =
        last.querySelector('[property="service"]')?.getAttribute("value") ||
        "beam";

      window.relayMessage({
        platform,
        username,
        html: html + stickerHTML, // ⭐ merge sticker into message
        avatar,
        badges
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log("Beam chat observer active.");
}

app.get("/overlay", (_req, res) => {
  res.sendFile(path.join(__dirname, "overlay.html"));
});

setInterval(() => {
  fetch("https://" + process.env.RAILWAY_STATIC_URL)
    .then(() => console.log("Keep-alive ping sent"))
    .catch(() => {});
}, 1000 * 60 * 4);

const server = app.listen(port, () => {
  console.log("Server listening on " + port);

  startBrowser().catch((err) => {
    console.error("Browser failed to start:", err);
  });

  startYouTube(broadcast);
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
