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

  // ---------------------------------------------------------
  // Expose relay function so browser → Node → overlay
  // ---------------------------------------------------------
  await page.exposeFunction("relayMessage", (msg) => {
    console.log("New chat message:", msg);
    broadcast(msg);
  });

  // ---------------------------------------------------------
  // MutationObserver extracts:
  // - username
  // - text
  // - avatar
  // - username color
  // ---------------------------------------------------------
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

            // Beam colored name
            const color = usernameEl?.style?.color || null;

            if (username && text) {
              window.relayMessage({ username, text, avatar, color });
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
<title>Beam Chat Overlay</title>
<style>
  body {
    margin: 0;
    background: transparent;
    font-family: Arial, sans-serif;
    overflow: hidden;
  }

  #messages {
    position: absolute;
    bottom: 0;
    width: 100%;
    padding: 20px;
    display: flex;
    flex-direction: column-reverse;
    gap: 14px;
  }

  /* -----------------------------------------
     UPDATED: Slower fade-in (0.8s)
     UPDATED: Background rgba(0,0,0,1)
  ----------------------------------------- */
  .msg {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(0,0,0,1);
    color: white;
    padding: 12px 16px;
    border-radius: 14px;
    font-size: 22px;
    max-width: 80%;
    backdrop-filter: blur(6px);
    animation: fadeIn 0.8s ease-out;
  }

  .avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .content {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  .username {
    font-weight: bold;
    margin-bottom: 4px;
  }

  /* -----------------------------------------
     UPDATED: Slower fade-out (1.2s)
  ----------------------------------------- */
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

    const content = document.createElement("div");
    content.className = "content";

    const name = document.createElement("div");
    name.className = "username";
    name.textContent = msg.username;
    name.style.color = msg.color || "white";
    content.appendChild(name);

    const text = document.createElement("div");
    text.textContent = msg.text;
    content.appendChild(text);

    wrapper.appendChild(content);

    document.getElementById("messages").prepend(wrapper);

    // -----------------------------------------
    // Auto-remove after 45 seconds
    // -----------------------------------------
    setTimeout(() => {
      wrapper.classList.add("fadeOut");
      setTimeout(() => wrapper.remove(), 1200);
    }, 45000);
  };
</script>
</body>
</html>`);
});

// ------------------------------
// KEEP-ALIVE PING (prevents Railway sleep)
// ------------------------------
setInterval(() => {
  fetch("https://" + process.env.RAILWAY_STATIC_URL)
    .then(() => console.log("Keep-alive ping sent"))
    .catch(() => {});
}, 1000 * 60 * 4); // every 4 minutes

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
