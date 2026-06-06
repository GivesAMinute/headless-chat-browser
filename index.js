import express from "express";
import puppeteer from "puppeteer";
import { WebSocketServer } from "ws";

const app = express();
const port = process.env.PORT || 8080;

let browser;
let page;

// ------------------------------
// WebSocket server for overlays
// ------------------------------
const wss = new WebSocketServer({ noServer: true });

function broadcast(msg) {
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(msg));
    }
  }
}

// ------------------------------
// Start headless browser
// ------------------------------
async function startBrowser() {
  console.log("Launching headless browser…");

  browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer"
    ]
  });

  page = await browser.newPage();

  console.log("Loading Beamstream chat…");

  await page.goto("https://beamstream.gg/givesaminute/chat", {
    waitUntil: "networkidle2"
  });

  console.log("Injecting message observer…");

  // Expose relay function to Node
  await page.exposeFunction("relayMessage", (msg) => {
    console.log("New chat message:", msg);
    broadcast(msg);
  });

  // Inject MutationObserver into the page
  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (
            node.nodeType === 1 &&
            node.getAttribute("typeof") === "ChatMessage"
          ) {
            const username = node
              .querySelector('[property="sender.name"]')
              ?.innerText.trim();

            const text = node
              .querySelector('[property="body"]')
              ?.innerText.trim();

            if (username && text) {
              window.relayMessage({ username, text });
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });

  console.log("Headless browser loaded Beamstream chat");
}

// ------------------------------
// Overlay route
// ------------------------------
app.get("/overlay", (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Beam Chat Overlay</title>
<style>
  body {
    margin: 0;
    background: transparent;
    font-family: Arial, sans-serif;
  }
  #messages {
    position: absolute;
    bottom: 0;
    width: 100%;
    padding: 20px;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
  }
  .msg {
    background: rgba(0,0,0,0.4);
    color: white;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 20px;
    max-width: 80%;
    backdrop-filter: blur(4px);
  }
</style>
</head>
<body>
<div id="messages"></div>

<script>
  const ws = new WebSocket("wss://" + location.host);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const div = document.createElement("div");
    div.className = "msg";
    div.textContent = msg.username + ": " + msg.text;
    document.getElementById("messages").prepend(div);
  };
</script>
</body>
</html>
  `);
});

// ------------------------------
// HTTP + WebSocket upgrade
// ------------------------------
const server = app.listen(port, () => {
  console.log("Server listening on " + port);
  startBrowser().catch((err) => {
    console.error("Browser failed to start:", err);
  });
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
