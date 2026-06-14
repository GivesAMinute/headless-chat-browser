import fetch from "node-fetch";

const TOKEN = process.env.VELORA_TOKEN;
const CHANNEL_ID = "4f1cb975-eace-4650-8246-053007bd0036";

async function run() {
  const query = `
    query ChannelEmotes($channelId: ID!) {
      channel(id: $channelId) {
        emoteCollections {
          emotes {
            code
            assetVariants {
              static2x
              static1x
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.velora.tv/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      query,
      variables: { channelId: CHANNEL_ID },
    }),
  });

  console.log("STATUS:", res.status);
  console.log("RAW:", await res.text());
}

run();
