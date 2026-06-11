// platforms/kick.js

export function renderKick(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg";

  const icon = document.createElement("img");
  icon.className = "platform-icon";
  icon.src = `/icons/kick.png`;
  wrapper.appendChild(icon);

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = `[Kick renderer not implemented yet]`;

  wrapper.appendChild(bubble);

  return {
    element: wrapper,
    cleanup: () => {}
  };
}
