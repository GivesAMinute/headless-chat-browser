// platforms/twitch.js

import { sanitizeHTML } from "../utils/sanitizeHTML.js";
import { colorForUsername } from "../utils/usernameColors.js";
import { renderUniversalBadges } from "../badges/universalBadges.js";

export function renderTwitchMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg";

  const icon = document.createElement("img");
  icon.className = "platform-icon";
  icon.src = `/icons/twitch.png`;
  wrapper.appendChild(icon);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const content = document.createElement("div");
  content.className = "content";

  if (msg.badges?.length) {
    content.insertAdjacentHTML("beforeend", renderUniversalBadges(msg.badges));
  }

  const name = document.createElement("div");
  name.className = "username";
  name.textContent = msg.username;
  name.style.color = colorForUsername(msg.username, "twitch");
  content.appendChild(name);

  const text = document.createElement("div");
  text.innerHTML = sanitizeHTML(msg.html);

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
