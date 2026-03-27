import {
  auth,
  db,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const ALLOWED_ADMIN_EMAIL = "mrthanh20069@gmail.com";
const PAGE_SIZE = 5;

const CLOUDINARY_CLOUD_NAME = "db7hl3qma";
const CLOUDINARY_UPLOAD_PRESET = "community_unsigned";

const adminLoginWrap = document.getElementById("adminLoginWrap");
const adminDashboard = document.getElementById("adminDashboard");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const adminLoginStatus = document.getElementById("adminLoginStatus");
const logoutBtn = document.getElementById("logoutBtn");

const pendingPostsTableBody = document.getElementById("pendingPostsTableBody");
const approvedPostsTableBody = document.getElementById("approvedPostsTableBody");
const pendingPagination = document.getElementById("pendingPagination");
const approvedPagination = document.getElementById("approvedPagination");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");

const editModal = document.getElementById("editModal");
const editModalOverlay = document.getElementById("editModalOverlay");
const closeEditModalBtn = document.getElementById("closeEditModalBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editForm = document.getElementById("editForm");
const editPostId = document.getElementById("editPostId");
const editPostType = document.getElementById("editPostType");
const editAuthorName = document.getElementById("editAuthorName");
const editTitle = document.getElementById("editTitle");
const editContent = document.getElementById("editContent");
const editImageInput = document.getElementById("editImageInput");
const editPreviewImage = document.getElementById("editPreviewImage");
const editStatus = document.getElementById("editStatus");
const saveEditBtn = document.getElementById("saveEditBtn");

let pendingPosts = [];
let approvedPosts = [];
let pendingPage = 1;
let approvedPage = 1;

let currentEditImageUrl = "";
let newEditImageFile = null;

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Vừa xong";
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("vi-VN");
}

function setLoginStatus(message, isError = false) {
  adminLoginStatus.textContent = message;
  adminLoginStatus.style.color = isError ? "#d93025" : "#1b7f3a";
}

function setEditStatus(message, isError = false) {
  editStatus.textContent = message;
  editStatus.style.color = isError ? "#d93025" : "#1b7f3a";
}

function showLogin() {
  adminLoginWrap.style.display = "flex";
  adminDashboard.style.display = "none";
}

function showDashboard() {
  adminLoginWrap.style.display = "none";
  adminDashboard.style.display = "block";
}

function renderEmptyRow(message) {
  return `
    <tr>
      <td colspan="5">
        <div class="empty-feed admin-empty-table">${message}</div>
      </td>
    </tr>
  `;
}

function getImageCell(imageUrl, title) {
  if (imageUrl) {
    return `
      <img
        class="admin-thumb"
        src="${escapeHtml(imageUrl)}"
        alt="${escapeHtml(title || "Post image")}"
      >
    `;
  }

  return `<div class="admin-thumb admin-thumb-placeholder">No image</div>`;
}

function shouldCollapseText(text = "", limit = 160) {
  return text.trim().length > limit;
}

function renderExpandableText(text = "") {
  const safeText = escapeHtml(text).replace(/\n/g, "<br>");
  const collapsed = shouldCollapseText(text);

  return `
    <div class="admin-post-text-wrap">
      <p class="admin-post-text ${collapsed ? "is-collapsed" : ""}" data-full="0">
        ${safeText}
      </p>
      ${collapsed ? `<button type="button" class="admin-more-btn">Thêm</button>` : ""}
    </div>
  `;
}

function renderPostRow(id, post, isPending = true) {
  const displayDate = isPending
    ? formatDate(post.createdAt)
    : formatDate(post.approvedAt || post.createdAt);

  return `
    <tr>
      <td>${getImageCell(post.imageUrl, post.title)}</td>

      <td>
        <div class="admin-post-cell">
          <h3 title="${escapeHtml(post.title || "")}">
            ${escapeHtml(post.title || "(No title)")}
          </h3>
          ${renderExpandableText(post.content || "")}
        </div>
      </td>

      <td>
        <div class="admin-author-cell">
          <span class="admin-author-badge">
            ${escapeHtml((post.authorName || "U").charAt(0).toUpperCase())}
          </span>
          <strong>${escapeHtml(post.authorName || "Unknown")}</strong>
        </div>
      </td>

      <td>
        <span class="admin-date-cell">${displayDate}</span>
      </td>

      <td>
        <div class="admin-table-actions">
          ${
            isPending
              ? `
                <button class="edit-btn" data-id="${id}" data-type="pending">Sửa</button>
                <button class="approve-btn" data-id="${id}">Duyệt</button>
                <button class="reject-btn" data-id="${id}">Xóa</button>
              `
              : `
                <button class="edit-btn" data-id="${id}" data-type="approved">Sửa</button>
                <button class="delete-btn" data-id="${id}">Xóa</button>
              `
          }
        </div>
      </td>
    </tr>
  `;
}

function paginateArray(arr, page, pageSize) {
  const start = (page - 1) * pageSize;
  return arr.slice(start, start + pageSize);
}

function renderPagination(totalItems, currentPage, mountEl, onChange) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  if (totalItems <= PAGE_SIZE) {
    mountEl.innerHTML = "";
    return;
  }

  let html = `
    <button class="pagination-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>
      Prev
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <button class="pagination-btn ${i === currentPage ? "active" : ""}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  html += `
    <button class="pagination-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>
      Next
    </button>
  `;

  mountEl.innerHTML = html;

  mountEl.querySelectorAll(".pagination-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.dataset.page);
      if (!page || page < 1 || page > totalPages || page === currentPage) return;
      onChange(page);
    });
  });
}

async function uploadToCloudinary(file) {
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "community-posts");

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Cloudinary upload failed");
  }

  const data = await response.json();
  return data.secure_url;
}

function renderPendingTable() {
  pendingCount.textContent = `${pendingPosts.length} bài`;

  if (!pendingPosts.length) {
    pendingPostsTableBody.innerHTML = renderEmptyRow("Không có bài chờ duyệt.");
    pendingPagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(pendingPosts.length / PAGE_SIZE));
  if (pendingPage > totalPages) pendingPage = totalPages;

  const pageItems = paginateArray(pendingPosts, pendingPage, PAGE_SIZE);

  pendingPostsTableBody.innerHTML = pageItems
    .map((item) => renderPostRow(item.id, item.data, true))
    .join("");

  renderPagination(pendingPosts.length, pendingPage, pendingPagination, (page) => {
    pendingPage = page;
    renderPendingTable();
  });
}

function renderApprovedTable() {
  approvedCount.textContent = `${approvedPosts.length} bài`;

  if (!approvedPosts.length) {
    approvedPostsTableBody.innerHTML = renderEmptyRow("Không có bài đã duyệt.");
    approvedPagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(approvedPosts.length / PAGE_SIZE));
  if (approvedPage > totalPages) approvedPage = totalPages;

  const pageItems = paginateArray(approvedPosts, approvedPage, PAGE_SIZE);

  approvedPostsTableBody.innerHTML = pageItems
    .map((item) => renderPostRow(item.id, item.data, false))
    .join("");

  renderPagination(approvedPosts.length, approvedPage, approvedPagination, (page) => {
    approvedPage = page;
    renderApprovedTable();
  });
}

async function handleLogin(event) {
  event.preventDefault();

  const email = adminEmail.value.trim();
  const password = adminPassword.value.trim();

  if (!email || !password) {
    setLoginStatus("Vui lòng nhập email và mật khẩu.", true);
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (user.email !== ALLOWED_ADMIN_EMAIL) {
      await signOut(auth);
      setLoginStatus("Tài khoản này không có quyền admin.", true);
      return;
    }

    setLoginStatus("Đăng nhập thành công.");
  } catch (error) {
    console.error(error);
    setLoginStatus("Đăng nhập thất bại.", true);
  }
}

function watchPendingPosts() {
  const q = query(
    collection(db, "posts"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      pendingPosts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data()
      }));
      renderPendingTable();
    },
    (error) => {
      console.error(error);
      pendingPostsTableBody.innerHTML = renderEmptyRow("Không tải được bài chờ duyệt.");
    }
  );
}

function watchApprovedPosts() {
  const q = query(
    collection(db, "posts"),
    where("status", "==", "approved"),
    orderBy("approvedAt", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      approvedPosts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data()
      }));
      renderApprovedTable();
    },
    (error) => {
      console.error(error);
      approvedPostsTableBody.innerHTML = renderEmptyRow("Không tải được bài đã duyệt.");
    }
  );
}

function findPostById(postId, type) {
  const source = type === "approved" ? approvedPosts : pendingPosts;
  return source.find((item) => item.id === postId) || null;
}

function openEditModal(postId, type) {
  const found = findPostById(postId, type);
  if (!found) {
    alert("Không tìm thấy bài viết.");
    return;
  }

  const post = found.data;

  editPostId.value = postId;
  editPostType.value = type;
  editAuthorName.value = post.authorName || "";
  editTitle.value = post.title || "";
  editContent.value = post.content || "";

  currentEditImageUrl = post.imageUrl || "";
  newEditImageFile = null;
  editImageInput.value = "";

  if (currentEditImageUrl) {
    editPreviewImage.src = currentEditImageUrl;
    editPreviewImage.style.display = "block";
  } else {
    editPreviewImage.src = "";
    editPreviewImage.style.display = "none";
  }

  setEditStatus("");
  editModal.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeEditModal() {
  editModal.classList.remove("show");
  document.body.style.overflow = "";
}

async function saveEditPost(event) {
  event.preventDefault();

  const postId = editPostId.value.trim();
  const author = editAuthorName.value.trim();
  const title = editTitle.value.trim();
  const content = editContent.value.trim();

  if (!postId || !author || !title || !content) {
    setEditStatus("Vui lòng nhập đầy đủ thông tin.", true);
    return;
  }

  saveEditBtn.disabled = true;
  saveEditBtn.textContent = "Đang lưu...";
  setEditStatus("Đang cập nhật bài viết...");

  try {
    let nextImageUrl = currentEditImageUrl || "";

    if (newEditImageFile) {
      setEditStatus("Đang upload ảnh lên Cloudinary...");
      nextImageUrl = await uploadToCloudinary(newEditImageFile);
    }

    await updateDoc(doc(db, "posts", postId), {
      authorName: author,
      title,
      content,
      imageUrl: nextImageUrl,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.email || null
    });

    setEditStatus("Lưu thành công.");
    closeEditModal();
  } catch (error) {
    console.error(error);
    setEditStatus("Lưu thất bại.", true);
  } finally {
    saveEditBtn.disabled = false;
    saveEditBtn.textContent = "Lưu thay đổi";
  }
}

async function approvePost(postId) {
  try {
    await updateDoc(doc(db, "posts", postId), {
      status: "approved",
      approvedAt: serverTimestamp(),
      approvedBy: auth.currentUser?.email || null
    });
  } catch (error) {
    console.error(error);
    alert("Duyệt bài thất bại.");
  }
}

async function rejectPost(postId) {
  try {
    await deleteDoc(doc(db, "posts", postId));
  } catch (error) {
    console.error(error);
    alert("Xóa bài thất bại.");
  }
}

async function deleteApprovedPost(postId) {
  try {
    await deleteDoc(doc(db, "posts", postId));
  } catch (error) {
    console.error(error);
    alert("Xóa bài thất bại.");
  }
}

function toggleText(buttonEl) {
  const wrap = buttonEl.closest(".admin-post-text-wrap");
  const textEl = wrap?.querySelector(".admin-post-text");
  if (!textEl) return;

  const expanded = textEl.dataset.full === "1";

  if (expanded) {
    textEl.classList.add("is-collapsed");
    textEl.dataset.full = "0";
    buttonEl.textContent = "Thêm";
  } else {
    textEl.classList.remove("is-collapsed");
    textEl.dataset.full = "1";
    buttonEl.textContent = "Ẩn bớt";
  }
}

pendingPostsTableBody.addEventListener("click", async (event) => {
  const moreBtn = event.target.closest(".admin-more-btn");
  if (moreBtn) {
    toggleText(moreBtn);
    return;
  }

  const editBtn = event.target.closest(".edit-btn");
  if (editBtn) {
    openEditModal(editBtn.dataset.id, editBtn.dataset.type);
    return;
  }

  const approveBtn = event.target.closest(".approve-btn");
  if (approveBtn) {
    await approvePost(approveBtn.dataset.id);
    return;
  }

  const rejectBtn = event.target.closest(".reject-btn");
  if (rejectBtn) {
    const ok = confirm("Bạn có chắc muốn xóa bài này?");
    if (ok) {
      await rejectPost(rejectBtn.dataset.id);
    }
  }
});

approvedPostsTableBody.addEventListener("click", async (event) => {
  const moreBtn = event.target.closest(".admin-more-btn");
  if (moreBtn) {
    toggleText(moreBtn);
    return;
  }

  const editBtn = event.target.closest(".edit-btn");
  if (editBtn) {
    openEditModal(editBtn.dataset.id, editBtn.dataset.type);
    return;
  }

  const deleteBtn = event.target.closest(".delete-btn");
  if (deleteBtn) {
    const ok = confirm("Bạn có chắc muốn xóa bài đã duyệt này?");
    if (ok) {
      await deleteApprovedPost(deleteBtn.dataset.id);
    }
  }
});

editImageInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  newEditImageFile = file;

  const tempUrl = URL.createObjectURL(file);
  editPreviewImage.src = tempUrl;
  editPreviewImage.style.display = "block";

  setEditStatus("Đã chọn ảnh mới. Khi lưu sẽ upload lên Cloudinary.");
});

closeEditModalBtn.addEventListener("click", closeEditModal);
cancelEditBtn.addEventListener("click", closeEditModal);
editModalOverlay.addEventListener("click", closeEditModal);
editForm.addEventListener("submit", saveEditPost);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && editModal.classList.contains("show")) {
    closeEditModal();
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

adminLoginForm.addEventListener("submit", handleLogin);

onAuthStateChanged(auth, (user) => {
  if (user && user.email === ALLOWED_ADMIN_EMAIL) {
    showDashboard();
    watchPendingPosts();
    watchApprovedPosts();
  } else {
    showLogin();
  }
});