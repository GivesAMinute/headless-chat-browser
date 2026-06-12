// platforms/blaze.js

import { colorForUsername } from "../utils/usernameColors.js";
import { sanitizeHTML } from "../utils/sanitizeHTML.js";

export function renderBlazeMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg blaze-msg";

  // Big platform icon
  const bigAvatar = document.createElement("img");
  bigAvatar.className = "avatar";
  bigAvatar.src = "/icons/blaze.png";
  wrapper.appendChild(bigAvatar);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // Header row
  const header = document.createElement("div");
  header.className = "header";

  // Small avatar
  const smallAvatar = document.createElement("img");
  smallAvatar.className = "avatar-small";
  smallAvatar.src = msg.avatar || "/icons/user-default.png";
  header.appendChild(smallAvatar);

  // Username (Blaze uses sender.displayName)
  const name = document.createElement("span");
  name.className = "username";
  name.textContent = msg.username || msg.displayName || msg.sender || "Unknown";
  name.style.color = colorForUsername(name.textContent, "blaze");
  header.appendChild(name);

  // Badges (Blaze scraper sends array of strings)
  if (msg.badges?.length) {
    msg.badges.forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      img.className = "badge";
      header.appendChild(img);
    });
  }

  bubble.appendChild(header);

  // Message body
  const text = document.createElement("div");
  text.className = "text";
  text.innerHTML = sanitizeHTML(msg.html || msg.message || "");
  bubble.appendChild(text);

  wrapper.appendChild(bubble);

  return {
    element: wrapper,
    cleanup() {
      setTimeout(() => {
        bubble.classList.add("fadeOut");
        setTimeout(() => wrapper.remove(), 600);
      }, 45000);
    }
  };
}
