import express from "express";
import puppeteer from "puppeteer";

const app = express();
const port = process.env.PORT || 8080;

let browser;
let page;

async function startBrowser() {
  console.log("Launching headless browser…");

  browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // from Dockerfile
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

  console.log("Headless browser loaded Beamstream chat");
}

app.get("/", (_req, res) => {
  res.send("Headless Chat Browser is running.");
});

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
  startBrowser().catch((err) => {
    console.error("Browser failed to start:", err);
  });
});
