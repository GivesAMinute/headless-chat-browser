// platforms/blaze.js

import { sanitizeHTML } from "../utils/sanitizeHTML.js";
import { colorForUsername } from "../utils/usernameColors.js";

import {
  MOD_BADGE,
  OG_BADGE,
  VIP_BADGE,
  STREAMER_BADGE
} from "../badges/blazeBadges.js";

export function renderBlaze(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg";

  // Platform icon
  const icon = document.createElement("img");
  icon.className = "platform-icon";
  icon.src = `/icons/blaze.png`;
  wrapper.appendChild(icon);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const content = document.createElement("div");
  content.className = "content";

  // Blaze role badges
  if (msg.isMod)      content.insertAdjacentHTML("beforeend", MOD_BADGE);
  if (msg.isOG)       content.insertAdjacentHTML("beforeend", OG_BADGE);
  if (msg.isVIP)      content.insertAdjacentHTML("beforeend", VIP_BADGE);
  if (msg.isStreamer) content.insertAdjacentHTML("beforeend", STREAMER_BADGE);

  // Username
  const name = document.createElement("div");
  name.className = "username";
  name.textContent = msg.username;
  name.style.color = colorForUsername(msg.username, "blaze");
  content.appendChild(name);

  // Message HTML
  const text = document.createElement("div");
  text.innerHTML = sanitizeHTML(msg.html);

  // Emote scaling
  text.querySelectorAll("img").forEach(img => {
    const isSmall =
      (img.naturalWidth && img.naturalWidth <= 40) ||
      (img.width && img.width <= 40);

    if (isSmall) img.classList.add("scaled-emote");
  });

  // Video autoplay
  text.querySelectorAll("video").forEach(v => {
    v.muted = true;
    v.autoplay = true;
    v.loop = true;
    v.playsInline = true;
    v.play().catch(() => {});
  });

  content.appendChild(text);
  bubble.appendChild(content);
  wrapper.appendChild(bubble);

  return {
    element: wrapper,
    cleanup: () => {}
  };
}
