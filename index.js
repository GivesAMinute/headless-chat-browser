import express from "express";
import puppeteer from "puppeteer";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import { startYouTube } from "./sources/youtube.js";

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
// Start headless browser (Beam)
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

  //// >>> NEW BEAM LOGIN CODE <<<
  console.log("Injecting Beam login session…");

  // Load Beam homepage first
  await page.goto("https://beamstream.gg", { waitUntil: "domcontentloaded" });

  // Parse your Railway variable
  const storage = JSON.parse(process.env.BEAM_LOCALSTORAGE);

  // Inject your Beam session into localStorage
  await page.evaluate((storage) => {
    for (const [key, value] of Object.entries(storage)) {
      localStorage.setItem(key, value);
    }
  }, storage);

  console.log("Beam session injected. Loading chat…");
  //// >>> END NEW CODE <<<

  // Now load your chat page AS YOU (fully authenticated)
  await page.goto("https://beamstream.gg/givesaminute/chat", {
    waitUntil: "networkidle2"
  });

  console.log("Injecting message observer…");

  await page.exposeFunction("relayMessage", (msg) => {
    console.log("New chat message:", msg);
    broadcast(msg);
  });

  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (
            node.nodeType === 1 &&
            node.getAttribute("typeof") === "ChatMessage"
          ) {
            const usernameEl = node.querySelector('[property="sender.name"]');
            const textEl = node.querySelector('[property="body"]');
            const avatarEl = node.querySelector('[property="avatar"]');

            const username = usernameEl?.innerText.trim();
            const text = textEl?.innerText.trim();
            const avatar = avatarEl?.src || null;

            if (username && text) {
              window.relayMessage({
                platform: "beam",
                username,
                text,
                avatar
              });
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
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Merged Chat Overlay</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

  body {
    margin: 0;
    background: transparent;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow: hidden;
  }

  #messages {
    position: absolute;
    bottom: 0;
    width: 100%;
    padding: 20px;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
    align-items: flex-start;
  }

  .msg {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .bubble {
    background: rgba(0,0,0,1);
    color: white;
    padding: 8px 12px;
    border-radius: 14px;
    font-size: 20px;
    max-width: 70%;
    display: inline-block;
    backdrop-filter: blur(6px);
    animation: fadeIn 0.8s ease-out;
  }

  .username {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .fadeOut {
    animation: fadeOut 1.2s forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-20px); }
  }
</style>
</head>
<body>
<div id="messages"></div>

<script>
  const ws = new WebSocket("wss://" + location.host);

  function colorForUsername(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return "hsl(" + hue + ", 70%, 60%)";
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    const wrapper = document.createElement("div");
    wrapper.className = "msg";

    if (msg.avatar) {
      const img = document.createElement("img");
      img.className = "avatar";
      img.src = msg.avatar;
      wrapper.appendChild(img);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const content = document.createElement("div");
    content.className = "content";

    const name = document.createElement("div");
    name.className = "username";
    name.textContent = msg.username;
    name.style.color = colorForUsername(msg.username);
    content.appendChild(name);

    const text = document.createElement("div");
    text.textContent = msg.text;
    content.appendChild(text);

    bubble.appendChild(content);
    wrapper.appendChild(bubble);

    document.getElementById("messages").prepend(wrapper);

    setTimeout(() => {
      bubble.classList.add("fadeOut");
      setTimeout(() => wrapper.remove(), 1200);
    }, 45000);
  };
</script>
</body>
</html>`);
});

// ------------------------------
// KEEP-ALIVE PING
// ------------------------------
setInterval(() => {
  fetch("https://" + process.env.RAILWAY_STATIC_URL)
    .then(() => console.log("Keep-alive ping sent"))
    .catch(() => {});
}, 1000 * 60 * 4);

// ------------------------------
// HTTP + WebSocket upgrade
// ------------------------------
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
