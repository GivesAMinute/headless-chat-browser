// platforms/velora.js

import { colorForUsername } from "../utils/usernameColors.js";
import { renderVeloraBadges } from "../badges/veloraBadges.js";

/* ---------------------------------------------------------
   PERFORMANCE LAYER: CACHES
--------------------------------------------------------- */

const veloraBadgeHTMLCache = new Map();

function getCachedBadgeHTML(badges) {
  const key = badges.join("|");
  if (veloraBadgeHTMLCache.has(key)) {
    return veloraBadgeHTMLCache.get(key);
  }

  const html = renderVeloraBadges(badges);
  veloraBadgeHTMLCache.set(key, html);
  return html;
}

/* ---------------------------------------------------------
   FAST INLINE MEDIA HANDLER
--------------------------------------------------------- */

function optimizeInlineMedia(textEl) {
  const nodes = textEl.querySelectorAll("img, video");

  nodes.forEach(node => {
    if (node.tagName === "IMG") {
      const w = node.naturalWidth || node.width;
      if (w && w <= 40) {
        node.classList.add("scaled-emote");
      }
    }

    if (node.tagName === "VIDEO") {
      node.muted = true;
      node.autoplay = true;
      node.loop = true;
      node.playsInline = true;
      node.play().catch(() => {});
    }
  });
}

/* ---------------------------------------------------------
   MAIN RENDERER (Backend-Sanitized Version)
--------------------------------------------------------- */

export function renderVeloraMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg velora-msg";

  const bigAvatar = document.createElement("img");
  bigAvatar.className = "avatar";
  bigAvatar.src = "/icons/velora.png";
  wrapper.appendChild(bigAvatar);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const header = document.createElement("div");
  header.className = "header";

  const smallAvatar = document.createElement("img");
  smallAvatar.className = "avatar-small";
  smallAvatar.src = msg.avatar || "/icons/user-default.png";
  header.appendChild(smallAvatar);

  const name = document.createElement("span");
  name.className = "username";
  name.textContent = msg.username;
  name.style.color = colorForUsername(msg.username, "velora");
  header.appendChild(name);

  if (msg.badges?.length) {
    const badgeContainer = document.createElement("span");
    badgeContainer.innerHTML = getCachedBadgeHTML(msg.badges);
    header.appendChild(badgeContainer);
  }

  bubble.appendChild(header);

  const text = document.createElement("div");
  text.className = "text";

  // ⭐ Backend-sanitized HTML
  text.innerHTML = msg.safeHtml || "";

  optimizeInlineMedia(text);

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
