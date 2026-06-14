import fetch from "node-fetch";

const CHANNEL_ID = "4f1cb975-eace-4650-8246-053007bd0036";

async function run() {
  const res = await fetch(
    `https://api.velora.tv/api/channel-points/${CHANNEL_ID}/items/with-built-in`
  );

  console.log("STATUS:", res.status);
  console.log("RAW:", await res.text());
}

run();
