import {
  subscribeFrames,
  saveSelectedFrame,
  buildBoothUrl,
} from "./frame-store.js";

const framesGrid = document.getElementById("framesGrid");
const emptyState = document.getElementById("framesEmpty");
const countBadge = document.getElementById("frameCount");
const openDemoBtn = document.getElementById("openFirstFrameBtn");
const refreshHint = document.getElementById("refreshHint");

let currentFrames = [];
let unsubscribe = null;

function renderSkeletons() {
  framesGrid.innerHTML = `
    <div class="skeleton-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
}

function renderFrameCard(frame) {
  const card = document.createElement("article");
  card.className = "frame-card";


  card.innerHTML = `
    <div class="frame-card__preview">
      <img src="${frame.thumbUrl}" alt="${frame.title}">
    </div>

  

    <div class="frame-card__content">
      <h3 class="frame-card__title">${frame.title}</h3>
      <p class="frame-card__meta">${frame.description || "Khung báo overlay lên camera."}</p>
    </div>

    <div class="frame-card__footer">
    
    </div>
  `;

  card.addEventListener("click", () => {
    saveSelectedFrame(frame);
    window.location.href = buildBoothUrl(frame);
  });

  return card;
}

function renderFrames(frames) {
  currentFrames = frames;
  countBadge.textContent = `${frames.length} khung`;

  if (!frames.length) {
    framesGrid.innerHTML = "";
    emptyState.style.display = "block";
    openDemoBtn.disabled = true;
    return;
  }

  emptyState.style.display = "none";
  openDemoBtn.disabled = false;
  framesGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  frames.forEach((frame) => fragment.appendChild(renderFrameCard(frame)));
  framesGrid.appendChild(fragment);
}

openDemoBtn.addEventListener("click", () => {
  const firstFrame = currentFrames[0];
  if (!firstFrame) return;
  saveSelectedFrame(firstFrame);
  window.location.href = buildBoothUrl(firstFrame);
});

refreshHint.addEventListener("click", () => {
  window.location.reload();
});

renderSkeletons();

unsubscribe = await subscribeFrames(
  (frames) => {
    renderFrames(frames);
  },
  () => {
    emptyState.hidden = false;
  }
);

window.addEventListener("beforeunload", () => {
  if (typeof unsubscribe === "function") unsubscribe();
});