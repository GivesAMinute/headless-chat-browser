// platforms/youtube.js

import { sanitizeHTML } from "../utils/sanitizeHTML.js";
import { colorForUsername } from "../utils/usernameColors.js";
import { renderUniversalBadges } from "../badges/universalBadges.js";

export function renderYouTube(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg";

  const icon = document.createElement("img");
  icon.className = "platform-icon";
  icon.src = `/icons/youtube.png`;
  wrapper.appendChild(icon);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const content = document.createElement("div");
  content.className = "content";

  // Badges
  if (msg.badges?.length) {
    content.insertAdjacentHTML("beforeend", renderUniversalBadges(msg.badges));
  }

  // Username cleanup
  let cleanName = msg.username;
  if (cleanName.startsWith("@")) cleanName = cleanName.substring(1);

  const name = document.createElement("div");
  name.className = "username";
  name.textContent = cleanName;
  name.style.color = colorForUsername(cleanName, "youtube");
  content.appendChild(name);

  const text = document.createElement("div");
  text.innerHTML = sanitizeHTML(msg.html);

  // Emote scaling
  text.querySelectorAll("img").forEach(img => {
    const isSmall =
      (img.naturalWidth && img.naturalWidth <= 40) ||
      (img.width && img.width <= 40);

    if (isSmall) img.classList.add("scaled-emote");
  });

  content.appendChild(text);
  bubble.appendChild(content);
  wrapper.appendChild(bubble);

  return {
    element: wrapper,
    cleanup: () => {}
  };
}
