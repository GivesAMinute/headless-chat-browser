import { renderBeamMessage } from "./beam.js";
import { renderTwitchMessage } from "./twitch.js";
import { renderVeloraMessage } from "./velora.js";
import { renderYouTubeMessage } from "./youtube.js";
import { renderBlazeMessage } from "./blaze.js";

export function renderMessage(msg) {
  const platform = msg.platform?.toLowerCase();

  switch (platform) {
    case "beam":
      return renderBeamMessage(msg);

    case "twitch":
      return renderTwitchMessage(msg);

    case "velora":
      return renderVeloraMessage(msg);

    case "youtube":
      return renderYouTubeMessage(msg);

    case "blaze":
      return renderBlazeMessage(msg);

    default:
      console.warn("Unknown platform:", platform, msg);
      return renderBeamMessage(msg);
  }
}
