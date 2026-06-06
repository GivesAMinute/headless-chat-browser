import fetch from "node-fetch";

// ------------------------------------------------------
// YOUTUBE LIVE CHAT INGESTION (CHANNEL-BASED)
// ------------------------------------------------------
// Env vars required:
//   YOUTUBE_API_KEY
//   YOUTUBE_CHANNEL_ID
// ------------------------------------------------------

export async function startYouTube(broadcast) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey || !channelId) {
    console.log("YouTube disabled: missing YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID");
    return;
  }

  console.log("Starting YouTube chat ingestion (channel-based)…");

  // Step 1 — find the active live broadcast for this channel
  const liveUrl =
    `https://www.googleapis.com/youtube/v3/liveBroadcasts` +
    `?part=snippet,contentDetails,status` +
    `&broadcastStatus=active` +
    `&broadcastType=all` +
    `&channelId=${channelId}` +
    `&key=${apiKey}`;

  const liveData = await fetch(liveUrl).then(r => r.json()).catch(err => {
    console.error("YouTube liveBroadcasts error:", err);
    return null;
  });

  const live = liveData?.items?.[0];
  const liveChatId = live?.snippet?.liveChatId;

  if (!liveChatId) {
    console.log("YouTube: No active live broadcast with liveChatId found.");
    return;
  }

  console.log("YouTube liveChatId:", liveChatId);

  // Step 2 — poll live chat messages
  let nextPageToken = "";
  async function poll() {
    try {
      const chatUrl =
        `https://www.googleapis.com/youtube/v3/liveChat/messages` +
        `?liveChatId=${liveChatId}` +
        `&part=snippet,authorDetails` +
        `&key=${apiKey}` +
        (nextPageToken ? `&pageToken=${nextPageToken}` : "");

      const data = await fetch(chatUrl).then(r => r.json());

      nextPageToken = data.nextPageToken || "";

      if (data.items) {
        for (const item of data.items) {
          const user = item.authorDetails;
          const snippet = item.snippet;

          const msg = {
            platform: "youtube",
            username: user.displayName,
            avatar: user.profileImageUrl,
            text: snippet.displayMessage,
            color: "#ff0000" // YouTube doesn't give per-user colors
          };

          broadcast(msg);
        }
      }

      const delay = data.pollingIntervalMillis || 1500;
      setTimeout(poll, delay);
    } catch (err) {
      console.error("YouTube chat error:", err);
      setTimeout(poll, 5000);
    }
  }

  poll();
}
