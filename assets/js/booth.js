import { getFrameById, getSelectedFrameFromStorage } from "./frame-store.js";

const EXPORT_WIDTH = 2480;
const EXPORT_HEIGHT = 3508;
const PHOTO_LAYOUT = {
  x: 0.08,
  y: 0.185,
  w: 0.84,
  h: 0.36
};

const stage = document.getElementById("cameraStage");
const frameOverlay = document.getElementById("frameOverlay");
const finalPreviewImage = document.getElementById("finalPreviewImage");
const cameraFeed = document.getElementById("cameraFeed");
const video = document.getElementById("cameraVideo");
const placeholder = document.getElementById("permissionPlaceholder");
const primaryActionBtn = document.getElementById("primaryActionBtn");
const retakeBtn = document.getElementById("retakeBtn");
const backToFramesBtn = document.getElementById("backToFramesBtn");
const statusTitle = document.getElementById("statusTitle");
const statusBody = document.getElementById("statusBody");
const frameTitleEl = document.getElementById("selectedFrameTitle");
const frameSourceEl = document.getElementById("selectedFrameSource");
const toastEl = document.getElementById("toast");
const mobilePrimaryActionBtn = document.getElementById("mobilePrimaryActionBtn");
const mobileRetakeBtn = document.getElementById("mobileRetakeBtn");
const loadingScreen = document.getElementById("loadingScreen");

const state = {
  stream: null,
  frame: null,
  frameImage: null,
  capturedBlob: null,
  capturedUrl: "",
  mode: "loading",
  toastTimer: null
};

function redirectToMainBooth() {
  window.location.href = "mainbooth.html";
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function showLoadingScreen() {
  if (!loadingScreen) return;
  loadingScreen.classList.remove("is-hidden");
}

function hideLoadingScreen() {
  if (!loadingScreen) return;
  loadingScreen.classList.add("is-hidden");
}

function setMode(nextMode) {
  state.mode = nextMode;

  const labels = {
    loading: "Đang tải khung và chuẩn bị camera...",
    ready: "Camera đã sẵn sàng",
    captured: "Ảnh đã chụp xong",
    saving: "Đang xử lý lưu ảnh...",
    error: "Không mở được camera"
  };

  const descriptions = {
    loading: "Vui lòng đợi khoảng 2 giây để hệ thống chuẩn bị photobooth.",
    ready: "Canh mặt vào khung lớn phía trên, hệ thống sẽ auto-fit như photobooth.",
    captured: "Desktop sẽ tải file PNG. iPhone / Android sẽ mở cửa sổ chia sẻ để bạn chọn Lưu hình ảnh.",
    saving: "Giữ nguyên màn hình một chút, mình đang tạo file PNG chất lượng cao.",
    error: "Kiểm tra quyền camera, HTTPS và thử mở lại trang."
  };

  if (statusTitle) statusTitle.textContent = labels[nextMode] || labels.loading;
  if (statusBody) statusBody.textContent = descriptions[nextMode] || descriptions.loading;

  const isCaptured = nextMode === "captured";
  const isBusy = nextMode === "loading" || nextMode === "saving" || nextMode === "error";

  if (primaryActionBtn) {
    primaryActionBtn.disabled = isBusy;
    primaryActionBtn.textContent = isCaptured ? "Lưu ảnh" : "Chụp ảnh";
  }

  if (mobilePrimaryActionBtn) {
    mobilePrimaryActionBtn.disabled = isBusy;
    mobilePrimaryActionBtn.textContent = isCaptured ? "Lưu ảnh" : "Chụp ảnh";
  }

  if (retakeBtn) retakeBtn.hidden = !isCaptured;
  if (mobileRetakeBtn) mobileRetakeBtn.hidden = !isCaptured;
  if (stage) stage.classList.toggle("is-captured", isCaptured);

  const dot = document.querySelector(".status-dot");
  if (dot) {
    dot.classList.toggle("is-warn", nextMode === "error");
  }
}

function showToast(message) {
  if (!toastEl) return;

  clearTimeout(state.toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");

  state.toastTimer = window.setTimeout(() => {
    toastEl.classList.remove("is-visible");
  }, 3400);
}

function getQueryFrameId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("frameId") || "";
}

function revokeCapturedUrl() {
  if (state.capturedUrl) {
    URL.revokeObjectURL(state.capturedUrl);
    state.capturedUrl = "";
  }
}

function stopStream() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
}

async function loadFrameImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function resolveSelectedFrame() {
  const stored = getSelectedFrameFromStorage();
  const frameId = getQueryFrameId();

  if (frameId) {
    const byId = await getFrameById(frameId);
    if (byId) return byId;
  }

  if (stored?.frameUrl) return stored;

  showToast("Bạn chưa chọn khung. Đang quay lại trang chọn khung...");
  await delay(1200);
  redirectToMainBooth();
  return null;
}

async function bootFrame() {
  state.frame = await resolveSelectedFrame();
  if (!state.frame) return false;

  state.frameImage = await loadFrameImage(state.frame.frameUrl);

  if (frameOverlay) frameOverlay.src = state.frame.frameUrl;
  if (frameTitleEl) frameTitleEl.textContent = state.frame.title || "Khung báo";
  if (frameSourceEl) {
    frameSourceEl.textContent =
      state.frame.source === "demo-local"
        ? "Đang dùng khung demo local."
        : "Khung đang đọc realtime từ Firestore / Cloudinary.";
  }

  return true;
}

async function startCamera() {
  setMode("loading");
  if (placeholder) placeholder.classList.remove("hidden");

  const constraints = {
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.stream = stream;
    if (video) {
      video.srcObject = stream;
      await video.play();
    }
    if (cameraFeed) cameraFeed.classList.add("is-live");
    if (placeholder) placeholder.classList.add("hidden");
    setMode("ready");
  } catch (error) {
    console.error(error);
    setMode("error");
    showToast("Không mở được camera. Hãy kiểm tra quyền truy cập hoặc chạy trên HTTPS.");
  }
}

function drawCover(ctx, source, dx, dy, dw, dh, mirror = false) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;

  if (!sw || !sh) {
    throw new Error("Nguồn ảnh chưa sẵn sàng.");
  }

  const sourceRatio = sw / sh;
  const targetRatio = dw / dh;

  let sx = 0;
  let sy = 0;
  let sWidth = sw;
  let sHeight = sh;

  if (sourceRatio > targetRatio) {
    sWidth = sh * targetRatio;
    sx = (sw - sWidth) / 2;
  } else {
    sHeight = sw / targetRatio;
    sy = (sh - sHeight) / 2;
  }

  ctx.save();

  if (mirror) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, dw, dh);
  } else {
    ctx.drawImage(source, sx, sy, sWidth, sHeight, dx, dy, dw, dh);
  }

  ctx.restore();
}

async function composeCaptureBlob() {
  if (!state.frameImage) {
    throw new Error("Khung PNG chưa sẵn sàng.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context không khả dụng.");
  }

  ctx.clearRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  const photoX = Math.round(EXPORT_WIDTH * PHOTO_LAYOUT.x);
  const photoY = Math.round(EXPORT_HEIGHT * PHOTO_LAYOUT.y);
  const photoW = Math.round(EXPORT_WIDTH * PHOTO_LAYOUT.w);
  const photoH = Math.round(EXPORT_HEIGHT * PHOTO_LAYOUT.h);

  drawCover(ctx, video, photoX, photoY, photoW, photoH, true);
  ctx.drawImage(state.frameImage, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Không tạo được PNG."));
          return;
        }
        resolve(blob);
      },
      "image/png",
      1
    );
  });
}

async function capturePhoto() {
  try {
    setMode("saving");
    const blob = await composeCaptureBlob();

    revokeCapturedUrl();
    state.capturedBlob = blob;
    state.capturedUrl = URL.createObjectURL(blob);

    if (finalPreviewImage) finalPreviewImage.src = state.capturedUrl;
    if (stage) stage.classList.add("is-captured");

    stopStream();
    setMode("captured");
    showToast("Chụp xong rồi. Bấm Lưu ảnh để tải hoặc mở cửa sổ chia sẻ.");
  } catch (error) {
    console.error(error);
    setMode("ready");
    showToast("Chụp ảnh chưa thành công, thử lại giúp mình.");
  }
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isMobileLike() {
  return isIOS() || isAndroid();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.target = "_self";
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
}

function openImageInNewTab(blob) {
  const previewUrl = URL.createObjectURL(blob);
  const newTab = window.open(previewUrl, "_blank", "noopener");

  if (!newTab) {
    showToast("Trình duyệt đang chặn mở tab mới. Hãy cho phép popup rồi thử lại.");
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 12000);
    return false;
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(previewUrl);
  }, 30000);

  return true;
}

function canShareCapturedFile(filename) {
  if (!navigator.share || typeof File === "undefined") return false;

  try {
    const file = new File([state.capturedBlob], filename, { type: "image/png" });

    if (navigator.canShare) {
      return navigator.canShare({ files: [file] });
    }

    return true;
  } catch (error) {
    return false;
  }
}

async function shareCapturedFile(filename) {
  const file = new File([state.capturedBlob], filename, { type: "image/png" });

  await navigator.share({
    title: "Photo Booth A4",
    text: "Ảnh PNG đã sẵn sàng.",
    files: [file]
  });
}

async function saveOrShare() {
  if (!state.capturedBlob) {
    showToast("Bạn cần chụp ảnh trước đã.");
    return;
  }

  const filename = `news-photo-booth-${Date.now()}.png`;

  if (!isMobileLike()) {
    triggerDownload(state.capturedBlob, filename);
    showToast("Ảnh PNG đang được tải về. Thường sẽ nằm trong thư mục Downloads.");
    return;
  }

  if (canShareCapturedFile(filename)) {
    try {
      await shareCapturedFile(filename);
      showToast("Đã mở cửa sổ chia sẻ. Hãy chọn Lưu hình ảnh / Save Image.");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Share failed", error);
    }
  }

  const opened = openImageInNewTab(state.capturedBlob);
  if (!opened) return;

  showToast("Thiết bị chưa hỗ trợ chia sẻ file. Ảnh đã mở ở tab mới để bạn tự lưu.");
}

async function retakePhoto() {
  revokeCapturedUrl();
  state.capturedBlob = null;
  if (stage) stage.classList.remove("is-captured");
  if (finalPreviewImage) finalPreviewImage.src = "";
  await startCamera();
}

async function handlePrimaryAction() {
  if (state.mode === "captured") {
    await saveOrShare();
    return;
  }

  if (state.mode === "ready") {
    await capturePhoto();
  }
}

if (primaryActionBtn) {
  primaryActionBtn.addEventListener("click", handlePrimaryAction);
}

if (mobilePrimaryActionBtn) {
  mobilePrimaryActionBtn.addEventListener("click", handlePrimaryAction);
}

if (retakeBtn) {
  retakeBtn.addEventListener("click", retakePhoto);
}

if (mobileRetakeBtn) {
  mobileRetakeBtn.addEventListener("click", retakePhoto);
}

if (backToFramesBtn) {
  backToFramesBtn.addEventListener("click", () => {
    window.location.href = "mainbooth.html";
  });
}

window.addEventListener("beforeunload", () => {
  revokeCapturedUrl();
  stopStream();
});

(async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ camera.");
    }

    showLoadingScreen();
    setMode("loading");

    const frameReady = await bootFrame();
    if (!frameReady) return;

    await delay(2000);
    hideLoadingScreen();
    await startCamera();
  } catch (error) {
    console.error(error);
    setMode("error");
    showToast(error.message || "Khởi tạo trang chụp thất bại.");
    hideLoadingScreen();
  }
})();