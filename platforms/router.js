// platforms/router.js

import { renderBlaze } from "./blaze.js";
import { renderBeam } from "./beam.js";
import { renderYouTube } from "./youtube.js";
import { renderTwitch } from "./twitch.js";
import { renderVelora } from "./velora.js";
import { renderKick } from "./kick.js";
import { renderRumble } from "./rumble.js";

import { applyExitAnimation } from "../utils/animations.js";

const PLATFORM_MAP = {
  youtube: "youtube",
  "youtube.com": "youtube",
  yt: "youtube",

  velora: "velora",
  "velora.live": "velora",

  pilled: "pilled",
  "pilled.net": "pilled",

  nimotv: "nimotv",
  nimo: "nimotv",

  kick: "kick",
  "kick.com": "kick",

  rumble: "rumble",
  odysee: "odysee",
  arena: "arena",

  blaze: "blaze",

  bitchute: "bitchute",
  vpzone: "vpzone",

  twitch: "twitch",
  beam: "beam"
};

export function renderMessage(msg) {
  const platform = PLATFORM_MAP[msg.platform?.toLowerCase()] || "unknown";

  let renderer;

  switch (platform) {
    case "blaze":   renderer = renderBlaze; break;
    case "beam":    renderer = renderBeam; break;
    case "youtube": renderer = renderYouTube; break;
    case "twitch":  renderer = renderTwitch; break;
    case "velora":  renderer = renderVelora; break;
    case "kick":    renderer = renderKick; break;
    case "rumble":  renderer = renderRumble; break;

    default:
      renderer = renderBeam; // fallback
  }

  const { element, cleanup } = renderer(msg);

  // Apply exit animation automatically
  applyExitAnimation(element);

  return { element, cleanup };
}
