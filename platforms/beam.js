// platforms/beam.js

import { sanitizeHTML } from "../utils/sanitizeHTML.js";
import { colorForUsername } from "../utils/usernameColors.js";

export function renderBeam(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg";

  // Beam uses avatar instead of platform icon
  if (msg.avatar) {
    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.src = msg.avatar;
    wrapper.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const content = document.createElement("div");
  content.className = "content";

  // Username
  const name = document.createElement("div");
  name.className = "username";
  name.textContent = msg.username;
  name.style.color = colorForUsername(msg.username, "beam");
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
