// platforms/velora.js

import { colorForUsername } from "../utils/usernameColors.js";
import { sanitizeHTML } from "../utils/sanitizeHTML.js";

export function renderVeloraMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg velora-msg";

  // Platform icon (big)
  const bigAvatar = document.createElement("img");
  bigAvatar.className = "avatar";
  bigAvatar.src = "/icons/velora.png";
  wrapper.appendChild(bigAvatar);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // Header row
  const header = document.createElement("div");
  header.className = "header";

  const smallAvatar = document.createElement("img");
  smallAvatar.className = "avatar-small";
  smallAvatar.src = msg.avatar || "/icons/velora.png";
  header.appendChild(smallAvatar);

  const name = document.createElement("span");
  name.className = "username";
  name.textContent = msg.username;
  name.style.color = colorForUsername(msg.username, "velora");
  header.appendChild(name);

  bubble.appendChild(header);

  // Text row
  const text = document.createElement("div");
  text.className = "text";
  text.innerHTML = sanitizeHTML(msg.html);

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
