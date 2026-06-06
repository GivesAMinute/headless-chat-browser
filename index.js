import express from "express";
import puppeteer from "puppeteer";

const app = express();
const port = process.env.PORT || 8080;

let browser;
let page;

async function startBrowser() {
  browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  page = await browser.newPage();

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
  startBrowser().catch(console.error);
});
