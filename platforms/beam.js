// platforms/beam.js

import { colorForUsername } from "../utils/usernameColors.js";
import { sanitizeHTML } from "../utils/sanitizeHTML.js";

export function renderBeamMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg beam-msg";

  // ⭐ Big platform icon (same class + size as all other platforms)
  const bigIcon = document.createElement("img");
  bigIcon.className = "platform-icon";
  bigIcon.src = "/icons/beam.png";
  wrapper.appendChild(bigIcon);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // ⭐ Header row: small user avatar + username
  const header = document.createElement("div");
  header.className = "header";

  const smallAvatar = document.createElement("img");
  smallAvatar.className = "avatar-small";
  smallAvatar.src = msg.avatar || "/icons/user-default.png";
  header.appendChild(smallAvatar);

  const name = document.createElement("span");
  name.className = "username";
  name.textContent = msg.username;
  name.style.color = colorForUsername(msg.username, "beam");
  header.appendChild(name);

  bubble.appendChild(header);

  // ⭐ Text row (indented)
  const text = document.createElement("div");
  text.className = "text";
  text.innerHTML = sanitizeHTML(msg.html);

  // Emote scaling
  text.querySelectorAll("img").forEach(img => {
    const isSmall =
      (img.naturalWidth && img.naturalWidth <= 40) ||
      (img.width && img.width <= 40);
    if (isSmall) img.classList.add("scaled-emote");
  });

  // Stickers (videos)
  text.querySelectorAll("video").forEach(v => {
    v.muted = true;
    v.autoplay = true;
    v.loop = true;
    v.playsInline = true;
    v.play().catch(() => {});
  });

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
