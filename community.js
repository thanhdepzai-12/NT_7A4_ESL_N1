import {
  db,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  increment
} from "./firebase.js";

const CLOUDINARY_CLOUD_NAME = "db7hl3qma";
const CLOUDINARY_UPLOAD_PRESET = "community_unsigned";

const postForm = document.getElementById("postForm");
const authorName = document.getElementById("authorName");
const postTitle = document.getElementById("postTitle");
const postContent = document.getElementById("postContent");
const postImageInput = document.getElementById("postImageInput");
const openEditorBtn = document.getElementById("openEditorBtn");
const postPreviewImage = document.getElementById("postPreviewImage");
const submitPostBtn = document.getElementById("submitPostBtn");
const postStatus = document.getElementById("postStatus");
const approvedPostsList = document.getElementById("approvedPostsList");

const editorModal = document.getElementById("editorModal");
const closeEditorBtn = document.getElementById("closeEditorBtn");
const cropBtn = document.getElementById("cropBtn");
const applyCropBtn = document.getElementById("applyCropBtn");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const overlayTextInput = document.getElementById("overlayTextInput");
const addTextBtn = document.getElementById("addTextBtn");
const saveEditedImageBtn = document.getElementById("saveEditedImageBtn");

let selectedFile = null;
let editedBlob = null;
let editorCanvas = null;
let currentImageObject = null;

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message, isError = false) {
  postStatus.textContent = message;
  postStatus.style.color = isError ? "#d93025" : "#1b7f3a";
}

function formatDate(value) {
  if (!value) return "Just now";
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("vi-VN");
}

function initCanvas() {
  if (editorCanvas) return;

  editorCanvas = new fabric.Canvas("editorCanvas", {
    backgroundColor: "#f2f4f7",
    preserveObjectStacking: true
  });

  editorCanvas.setWidth(800);
  editorCanvas.setHeight(500);
}

function resetCanvas() {
  if (!editorCanvas) return;
  editorCanvas.clear();
  editorCanvas.backgroundColor = "#f2f4f7";
  editorCanvas.renderAll();
  currentImageObject = null;
}

function openEditor() {
  if (!selectedFile) {
    setStatus("Please choose an image first.", true);
    return;
  }

  initCanvas();
  resetCanvas();

  const reader = new FileReader();
  reader.onload = function (e) {
    fabric.Image.fromURL(e.target.result, function (img) {
      const maxWidth = 700;
      const maxHeight = 420;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);

      img.set({
        left: 50,
        top: 40,
        scaleX: scale,
        scaleY: scale,
        selectable: true
      });

      currentImageObject = img;
      editorCanvas.add(img);
      editorCanvas.setActiveObject(img);
      editorCanvas.renderAll();

      editorModal.classList.add("show");
    });
  };

  reader.readAsDataURL(selectedFile);
}

function closeEditor() {
  editorModal.classList.remove("show");
}

function cropActiveImage() {
  const active = editorCanvas.getActiveObject();
  if (!active || active.type !== "image") {
    alert("Please select image first.");
    return;
  }

  const cropRect = new fabric.Rect({
    left: active.left + 30,
    top: active.top + 30,
    width: Math.max(100, active.getScaledWidth() / 2),
    height: Math.max(100, active.getScaledHeight() / 2),
    fill: "rgba(0,0,0,0.1)",
    stroke: "#2f855a",
    strokeWidth: 2,
    strokeDashArray: [6, 4]
  });

  cropRect.cropMarker = true;
  cropRect.setControlsVisibility({ mtr: false });

  editorCanvas.add(cropRect);
  editorCanvas.setActiveObject(cropRect);
  editorCanvas.renderAll();
}

function applyCrop() {
  const active = editorCanvas.getActiveObject();
  if (!active || !active.cropMarker || !currentImageObject) {
    alert("Please create crop area first.");
    return;
  }

  const img = currentImageObject;
  const rect = active;

  const cropX = (rect.left - img.left) / img.scaleX;
  const cropY = (rect.top - img.top) / img.scaleY;
  const cropWidth = rect.width * rect.scaleX / img.scaleX;
  const cropHeight = rect.height * rect.scaleY / img.scaleY;

  img.set({
    cropX: Math.max(0, cropX),
    cropY: Math.max(0, cropY),
    width: Math.max(20, cropWidth),
    height: Math.max(20, cropHeight)
  });

  img.scaleToWidth(Math.min(700, cropWidth));
  img.set({ left: 50, top: 40 });

  editorCanvas.remove(rect);
  editorCanvas.setActiveObject(img);
  editorCanvas.renderAll();
}

function rotateSelected(angle) {
  const active = editorCanvas.getActiveObject();
  if (!active) {
    alert("Select image or text first.");
    return;
  }
  active.rotate((active.angle || 0) + angle);
  editorCanvas.renderAll();
}

function zoomSelected(delta) {
  const active = editorCanvas.getActiveObject();
  if (!active) {
    alert("Select object first.");
    return;
  }

  const nextScaleX = (active.scaleX || 1) + delta;
  const nextScaleY = (active.scaleY || 1) + delta;

  if (nextScaleX < 0.1 || nextScaleY < 0.1) return;

  active.scaleX = nextScaleX;
  active.scaleY = nextScaleY;
  editorCanvas.renderAll();
}

function addTextToCanvas() {
  const text = overlayTextInput.value.trim();
  if (!text) {
    alert("Enter text first.");
    return;
  }

  const textObj = new fabric.IText(text, {
    left: 80,
    top: 80,
    fontSize: 28,
    fill: "#ffffff",
    stroke: "#000000",
    strokeWidth: 0.7,
    fontWeight: "bold"
  });

  editorCanvas.add(textObj);
  editorCanvas.setActiveObject(textObj);
  editorCanvas.renderAll();
  overlayTextInput.value = "";
}

function saveEditedImage() {
  const dataUrl = editorCanvas.toDataURL({
    format: "png",
    quality: 1
  });

  postPreviewImage.src = dataUrl;
  postPreviewImage.style.display = "block";

  fetch(dataUrl)
    .then(res => res.blob())
    .then(blob => {
      editedBlob = blob;
      closeEditor();
      setStatus("Edited image ready.");
    })
    .catch(() => setStatus("Cannot save edited image.", true));
}

async function uploadToCloudinary(fileOrBlob) {
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", fileOrBlob);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "community-posts");

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  const data = await response.json();
  return data.secure_url;
}

async function handleSubmit(e) {
  e.preventDefault();

  const name = authorName.value.trim();
  const title = postTitle.value.trim();
  const content = postContent.value.trim();

  if (!name || !title || !content) {
    setStatus("Please enter full information.", true);
    return;
  }

  submitPostBtn.disabled = true;
  submitPostBtn.textContent = "Posting...";
  setStatus("Submitting post...");

  try {
    let imageUrl = "";

    if (editedBlob) {
      imageUrl = await uploadToCloudinary(editedBlob);
    } else if (selectedFile) {
      imageUrl = await uploadToCloudinary(selectedFile);
    }

    await addDoc(collection(db, "posts"), {
      authorName: name,
      title,
      content,
      imageUrl,
      status: "pending",
      createdAt: serverTimestamp(),
      approvedAt: null,
      approvedBy: null,
      reactions: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0
      }
    });

    postForm.reset();
    selectedFile = null;
    editedBlob = null;
    postPreviewImage.src = "";
    postPreviewImage.style.display = "none";

    setStatus("Your post has been sent and is waiting for approval.");
  } catch (error) {
    console.error(error);
    setStatus("Submit failed.", true);
  } finally {
    submitPostBtn.disabled = false;
    submitPostBtn.textContent = "Post";
  }
}

function reactionLabel(key) {
  return {
    like: "👍 Like",
    love: "❤️ Love",
    haha: "😂 Haha",
    wow: "😮 Wow",
    sad: "😢 Sad",
    angry: "😡 Angry"
  }[key];
}
function shouldCollapseText(text = "", limit = 220) {
  return text.trim().length > limit;
}

function renderExpandableFeedText(text = "") {
  const safeText = escapeHtml(text).replace(/\n/g, "<br>");
  const collapsed = shouldCollapseText(text);

  return `
    <div class="feed-text-wrap">
      <p class="feed-text ${collapsed ? "is-collapsed" : ""}" data-full="0">
        ${safeText}
      </p>
      ${
        collapsed
          ? `<button type="button" class="feed-more-btn">Thêm</button>`
          : ""
      }
    </div>
  `;
}
function renderPostCard(id, post) {
  const reactions = post.reactions || {};
  const reactionKeys = ["like", "love", "haha", "wow", "sad", "angry"];

  return `
    <article class="feed-card">
      <div class="feed-card-head">
        <div class="feed-avatar">${escapeHtml((post.authorName || "U").charAt(0).toUpperCase())}</div>
        <div>
          <h3>${escapeHtml(post.authorName || "Unknown")}</h3>
          <p>${formatDate(post.approvedAt || post.createdAt)}</p>
        </div>
      </div>

      <div class="feed-card-body">
        <h4>${escapeHtml(post.title || "")}</h4>
        ${renderExpandableFeedText(post.content || "")}
        ${post.imageUrl ? `<img class="feed-image" src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.title || "Post image")}">` : ""}
      </div>

      <div class="feed-reactions">
        ${reactionKeys.map(key => `
          <button class="reaction-btn" data-id="${id}" data-reaction="${key}">
            ${reactionLabel(key)} <span>${reactions[key] || 0}</span>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function listenApprovedPosts() {
  const q = query(
    collection(db, "posts"),
    where("status", "==", "approved"),
    orderBy("approvedAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      approvedPostsList.innerHTML = `<p class="empty-feed">No approved posts yet.</p>`;
      return;
    }

    let html = "";
    snapshot.forEach((item) => {
      html += renderPostCard(item.id, item.data());
    });

    approvedPostsList.innerHTML = html;
  }, (error) => {
    console.error(error);
    approvedPostsList.innerHTML = `<p class="empty-feed">Cannot load feed.</p>`;
  });
}

async function handleReaction(e) {
  const btn = e.target.closest(".reaction-btn");
  if (!btn) return;

  const postId = btn.dataset.id;
  const reaction = btn.dataset.reaction;
  const localKey = `reacted_${postId}_${reaction}`;

  if (localStorage.getItem(localKey)) {
    alert("You already used this reaction.");
    return;
  }

  try {
    const postRef = doc(db, "posts", postId);
    const snap = await getDoc(postRef);

    if (!snap.exists()) {
      alert("Post not found.");
      return;
    }

    await updateDoc(postRef, {
      [`reactions.${reaction}`]: increment(1)
    });

    localStorage.setItem(localKey, "1");
  } catch (error) {
    console.error(error);
    alert("Reaction failed.");
  }
}

postImageInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  selectedFile = file;
  editedBlob = null;

  const tempUrl = URL.createObjectURL(file);
  postPreviewImage.src = tempUrl;
  postPreviewImage.style.display = "block";
  setStatus("Image selected.");
});

openEditorBtn.addEventListener("click", openEditor);
closeEditorBtn.addEventListener("click", closeEditor);
cropBtn.addEventListener("click", cropActiveImage);
applyCropBtn.addEventListener("click", applyCrop);
rotateLeftBtn.addEventListener("click", () => rotateSelected(-90));
rotateRightBtn.addEventListener("click", () => rotateSelected(90));
zoomInBtn.addEventListener("click", () => zoomSelected(0.1));
zoomOutBtn.addEventListener("click", () => zoomSelected(-0.1));
addTextBtn.addEventListener("click", addTextToCanvas);
saveEditedImageBtn.addEventListener("click", saveEditedImage);

postForm.addEventListener("submit", handleSubmit);
approvedPostsList.addEventListener("click", (e) => {
  const moreBtn = e.target.closest(".feed-more-btn");

  if (moreBtn) {
    const wrap = moreBtn.closest(".feed-text-wrap");
    const textEl = wrap?.querySelector(".feed-text");
    if (!textEl) return;

    const expanded = textEl.dataset.full === "1";

    if (expanded) {
      textEl.classList.add("is-collapsed");
      textEl.dataset.full = "0";
      moreBtn.textContent = "Thêm";
    } else {
      textEl.classList.remove("is-collapsed");
      textEl.dataset.full = "1";
      moreBtn.textContent = "Rút gon";
    }
    return;
  }

  handleReaction(e);
});

listenApprovedPosts();