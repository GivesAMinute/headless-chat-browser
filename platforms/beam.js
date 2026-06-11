// platforms/beam.js
import { colorForUsername } from "./utils/color.js";

export function renderBeamMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg beam-msg";

  // Avatar (Beam uses avatar instead of platform icon)
  if (msg.avatar) {
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = msg.avatar;
    wrapper.appendChild(img);
  }

  // Bubble
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
  text.innerHTML = msg.html;

  // Emote scaling
  text.querySelectorAll("img").forEach(img => {
    const isSmall =
      (img.naturalWidth && img.naturalWidth <= 40) ||
      (img.width && img.width <= 40);

    if (isSmall) {
      img.classList.add("scaled-emote");
    }
  });

  // Stickers (videos)
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
    cleanup() {
      setTimeout(() => {
        bubble.classList.add("fadeOut");
        setTimeout(() => wrapper.remove(), 600);
      }, 45000);
    }
  };
}
