// badges/veloraBadges.js

export function renderVeloraBadges(badges = []) {
  return badges
    .map(src => {
      const label = src.split("/").pop().replace(/\.(png|svg)/, "");
      return `
        <span class="tooltip-wrapper">
          <img class="velora-inline-badge" src="${src}">
          <span class="tooltip-bubble">${label}</span>
        </span>
      `;
    })
    .join("");
}
