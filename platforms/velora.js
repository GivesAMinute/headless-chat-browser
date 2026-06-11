// platforms/velora.js

import { colorForUsername } from "../utils/usernameColors.js";
import { sanitizeHTML } from "../utils/sanitizeHTML.js";
import { renderVeloraBadges } from "../badges/veloraBadges.js";

export function renderVeloraMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg velora-msg";

  // ⭐ Big avatar = platform icon (Velora logo)
  const bigAvatar = document.createElement("img");
  bigAvatar.className = "avatar";
  bigAvatar.src = "/icons/velora.png";
  wrapper.appendChild(bigAvatar);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // ⭐ Header row: small avatar + username + badges
  const header = document.createElement("div");
  header.className = "header";

  const smallAvatar = document.createElement("img");
  smallAvatar.className = "avatar-small";

  // ⭐ Correct behavior:
  // Use user avatar if available, otherwise fallback to a neutral user icon
  smallAvatar.src = msg.avatar || "/icons/user-default.png";
  header.appendChild(smallAvatar);

  const name = document.createElement("span");
  name.className = "username";
  name.textContent = msg.username;
  name.style.color = colorForUsername(msg.username, "velora");
  header.appendChild(name);

  // ⭐ Velora badges (inline)
  if (msg.badges?.length) {
    const badgeHTML = renderVeloraBadges(msg.badges);
    const badgeContainer = document.createElement("span");
    badgeContainer.innerHTML = badgeHTML;
    header.appendChild(badgeContainer);
  }

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
