import express from "express";
import puppeteer from "puppeteer";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

// Modular scrapers
import { startBeamScraper } from "./sources/beam.js";
import { startTwitchScraper } from "./sources/twitch.js";
import { startVeloraScraper } from "./sources/velora.js";
import { startYouTubeScraper } from "./sources/youtube.js";
import { startBlazeScraper } from "./sources/blaze.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Static assets
app.use("/icons", express.static(path.join(__dirname, "public/icons")));
app.use("/badges", express.static(path.join(__dirname, "badges")));
app.use("/utils", express.static(path.join(__dirname, "utils")));
app.use("/overlay", express.static(path.join(__dirname, "overlay")));
app.use("/platforms", express.static(path.join(__dirname, "platforms")));

let browser;

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

function broadcast(msg) {
  const json = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(json);
    }
  }
}

/* ---------------------------------------------------------
   EXPRESS ROUTES
--------------------------------------------------------- */
app.get("/overlay", (_req, res) => {
  res.sendFile(path.join(__dirname, "overlay/overlay.html"));
});

// Railway keep-alive
setInterval(() => {
  if (!process.env.RAILWAY_STATIC_URL) return;
  fetch("https://" + process.env.RAILWAY_STATIC_URL).catch(() => {});
}, 1000 * 60 * 4);

/* ---------------------------------------------------------
   SERVER STARTUP
--------------------------------------------------------- */
const server = app.listen(port, async () => {
  console.log("Server listening on " + port);

  console.log("Launching shared headless browser…");

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

  // Start Puppeteer-based scrapers
  startBeamScraper({ browser, broadcast });
  startTwitchScraper({ browser, broadcast });
  startVeloraScraper({ browser, broadcast });

  // Start API/socket-based scrapers
  startYouTubeScraper({ broadcast });
  startBlazeScraper({ broadcast });
});

/* ---------------------------------------------------------
   WEBSOCKET UPGRADE
--------------------------------------------------------- */
server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
