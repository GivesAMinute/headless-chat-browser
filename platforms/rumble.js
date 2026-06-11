// platforms/rumble.js

export function renderRumble(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg";

  const icon = document.createElement("img");
  icon.className = "platform-icon";
  icon.src = `/icons/rumble.png`;
  wrapper.appendChild(icon);

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = `[Rumble renderer not implemented yet]`;

  wrapper.appendChild(bubble);

  return {
    element: wrapper,
    cleanup: () => {}
  };
}
