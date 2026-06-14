import fetch from "node-fetch";

const CHANNEL_ID = "4f1cb975-eace-4650-8246-053007bd0036";

async function run() {
  console.log("Fetching GLOBAL emotes...");
  try {
    const res = await fetch("https://api.velora.tv/api/emotes/global");
    const text = await res.text();
    console.log("GLOBAL RAW RESPONSE:\n", text);
  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }

  console.log("\nFetching CHANNEL emotes...");
  try {
    const res2 = await fetch(`https://api.velora.tv/api/emotes/channel/${CHANNEL_ID}`);
    const text2 = await res2.text();
    console.log("CHANNEL RAW RESPONSE:\n", text2);
  } catch (err) {
    console.error("CHANNEL ERROR:", err);
  }
}

run();
