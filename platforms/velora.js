// platforms/velora.js

import { colorForUsername } from "../utils/usernameColors.js";
import { sanitizeHTML } from "../utils/sanitizeHTML.js";
import { renderVeloraBadges } from "../badges/veloraBadges.js";

/* ---------------------------------------------------------
   PERFORMANCE LAYER: CACHES
--------------------------------------------------------- */

const veloraBadgeHTMLCache = new Map();

/* Cache badge HTML so we don't re-render or re-parse it */
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
   PERFORMANCE LAYER: FAST EMOTE/STICKER SCAN
   (Single pass, no querySelectorAll)
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
   MAIN RENDERER (Optimized)
--------------------------------------------------------- */

export function renderVeloraMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg velora-msg";

  /* Big platform icon */
  const bigAvatar = document.createElement("img");
  bigAvatar.className = "avatar";
  bigAvatar.src = "/icons/velora.png";
  wrapper.appendChild(bigAvatar);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  /* Header row */
  const header = document.createElement("div");
  header.className = "header";

  /* Small avatar */
  const smallAvatar = document.createElement("img");
  smallAvatar.className = "avatar-small";
  smallAvatar.src = msg.avatar || "/icons/user-default.png";
  header.appendChild(smallAvatar);

  /* Username */
  const name = document.createElement("span");
  name.className = "username";
  name.textContent = msg.username;
  name.style.color = colorForUsername(msg.username, "velora");
  header.appendChild(name);

  /* Badges (cached HTML) */
  if (msg.badges?.length) {
    const badgeContainer = document.createElement("span");
    badgeContainer.innerHTML = getCachedBadgeHTML(msg.badges);
    header.appendChild(badgeContainer);
  }

  bubble.appendChild(header);

  /* Text row */
  const text = document.createElement("div");
  text.className = "text";

  // Sanitization is still applied, but only once
  text.innerHTML = sanitizeHTML(msg.html);

  // Optimized media handling
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
