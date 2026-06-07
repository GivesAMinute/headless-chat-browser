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
let beamPage;

const wss = new WebSocketServer({ noServer: true });

function broadcast(msg) {
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(msg));
    }
  }
}

/* ---------------------------------------------------------
   BEAM CHAT SCRAPER — ALLOW EVERYTHING EXCEPT TWITCH & VELORA
--------------------------------------------------------- */
async function startBeamChat() {
  console.log("Launching headless browser…");

  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--autoplay-policy=no-user-gesture-required"
    ]
  });

  beamPage = await browser.newPage();

  beamPage.on("console", (msg) => console.log("BEAM LOG:", msg.text()));

  console.log("Injecting Beam login session…");

  await beamPage.goto("https://beamstream.gg", { waitUntil: "domcontentloaded" });

  const storage = JSON.parse(process.env.BEAM_LOCALSTORAGE);

  await beamPage.evaluate((storage) => {
    for (const [key, value] of Object.entries(storage)) {
      localStorage.setItem(key, value);
    }
  }, storage);

  console.log("Beam session injected. Loading chat…");

  await beamPage.goto("https://beamstream.gg/givesaminute/chat", {
    waitUntil: "networkidle2"
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("Injecting Beam message observer…");

  await beamPage.exposeFunction("relayMessage", (msg) => {
    broadcast(msg);
  });

  await beamPage.evaluate(() => {
    const selector =
      'div[typeof="ChatMessage"], div[typeof="ChatMessageExternal"]';

    const observer = new MutationObserver(() => {
      const messages = [...document.querySelectorAll(selector)];
      const last = messages[messages.length - 1];
      if (!last) return;

      let platform =
        last.querySelector('[property="service"]')?.getAttribute("value") ||
        "beam";

      // Block Twitch (handled by Twitch scraper) and Velora (handled by Velora scraper)
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

/* ---------------------------------------------------------
   TWITCH CHAT SCRAPER — PER-USER BUFFER (ANIMATED EMOTES)
--------------------------------------------------------- */
async function startTwitchChat() {
  console.log("Starting Twitch chat scraper…");

  const twitchPage = await browser.newPage();

  await twitchPage.goto(
    "https://www.twitch.tv/popout/givesaminute/chat?popout=",
    { waitUntil: "networkidle2" }
  );

  const pendingByUser = new Map();

  await twitchPage.exposeFunction("relayTwitch", (msg) => {
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

  await twitchPage.evaluate(() => {
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

/* ---------------------------------------------------------
   VELORA CHAT SCRAPER — DIRECT FROM VELORE POPOUT
--------------------------------------------------------- */
async function startVeloraChat() {
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
      ].map(img => img.src);

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

/* ---------------------------------------------------------
   EXPRESS + SERVER
--------------------------------------------------------- */
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

  startBeamChat()
    .then(() => {
      return Promise.all([
        startTwitchChat(),
        startVeloraChat()
      ]);
    })
    .catch((err) => console.error("Startup error:", err));

  startYouTube(broadcast);
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
