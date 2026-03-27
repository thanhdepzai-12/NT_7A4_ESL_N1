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

/* =========================
   CONFIG
========================= */
const ALLOWED_ADMIN_EMAIL = "mrthanh20069@gmail.com";
const PAGE_SIZE = 5;

/* =========================
   DOM
========================= */
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

/* =========================
   STATE
========================= */
let pendingPosts = [];
let approvedPosts = [];

let pendingPage = 1;
let approvedPage = 1;

/* =========================
   HELPERS
========================= */
function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Just now";
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("vi-VN");
}

function setLoginStatus(message, isError = false) {
  adminLoginStatus.textContent = message;
  adminLoginStatus.style.color = isError ? "#d93025" : "#1b7f3a";
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
      ${
        collapsed
          ? `<button type="button" class="admin-more-btn">Thêm</button>`
          : ""
      }
    </div>
  `;
}

function renderPostRow(id, post, isPending = true) {
  const displayDate = isPending
    ? formatDate(post.createdAt)
    : formatDate(post.approvedAt || post.createdAt);

  return `
    <tr>
      <td>
        ${getImageCell(post.imageUrl, post.title)}
      </td>

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
                <button class="approve-btn" data-id="${id}">Approve</button>
                <button class="reject-btn" data-id="${id}">Reject</button>
              `
              : `
                <button class="delete-btn" data-id="${id}">Delete</button>
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

/* =========================
   RENDER TABLES
========================= */
function renderPendingTable() {
  pendingCount.textContent = `${pendingPosts.length} items`;

  if (!pendingPosts.length) {
    pendingPostsTableBody.innerHTML = renderEmptyRow("No pending posts.");
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
  approvedCount.textContent = `${approvedPosts.length} items`;

  if (!approvedPosts.length) {
    approvedPostsTableBody.innerHTML = renderEmptyRow("No approved posts.");
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

/* =========================
   AUTH
========================= */
async function handleLogin(event) {
  event.preventDefault();

  const email = adminEmail.value.trim();
  const password = adminPassword.value.trim();

  if (!email || !password) {
    setLoginStatus("Please enter email and password.", true);
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (user.email !== ALLOWED_ADMIN_EMAIL) {
      await signOut(auth);
      setLoginStatus("This account is not allowed.", true);
      return;
    }

    setLoginStatus("Login successful.");
  } catch (error) {
    console.error(error);
    setLoginStatus("Login failed.", true);
  }
}

/* =========================
   FIRESTORE WATCHERS
========================= */
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
      pendingPostsTableBody.innerHTML = renderEmptyRow("Cannot load pending posts.");
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
      approvedPostsTableBody.innerHTML = renderEmptyRow("Cannot load approved posts.");
    }
  );
}

/* =========================
   ACTIONS
========================= */
async function approvePost(postId) {
  try {
    await updateDoc(doc(db, "posts", postId), {
      status: "approved",
      approvedAt: serverTimestamp(),
      approvedBy: auth.currentUser?.email || null
    });
  } catch (error) {
    console.error(error);
    alert("Approve failed.");
  }
}

async function rejectPost(postId) {
  try {
    await deleteDoc(doc(db, "posts", postId));
  } catch (error) {
    console.error(error);
    alert("Reject failed.");
  }
}

async function deleteApprovedPost(postId) {
  try {
    await deleteDoc(doc(db, "posts", postId));
  } catch (error) {
    console.error(error);
    alert("Delete failed.");
  }
}

/* =========================
   CONTENT TOGGLE
========================= */
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

/* =========================
   EVENTS
========================= */
pendingPostsTableBody.addEventListener("click", async (event) => {
  const moreBtn = event.target.closest(".admin-more-btn");
  if (moreBtn) {
    toggleText(moreBtn);
    return;
  }

  const approveBtn = event.target.closest(".approve-btn");
  if (approveBtn) {
    await approvePost(approveBtn.dataset.id);
    return;
  }

  const rejectBtn = event.target.closest(".reject-btn");
  if (rejectBtn) {
    const ok = confirm("Reject and delete this post?");
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

  const deleteBtn = event.target.closest(".delete-btn");
  if (deleteBtn) {
    const ok = confirm("Delete this approved post?");
    if (ok) {
      await deleteApprovedPost(deleteBtn.dataset.id);
    }
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

adminLoginForm.addEventListener("submit", handleLogin);

/* =========================
   INIT
========================= */
onAuthStateChanged(auth, (user) => {
  if (user && user.email === ALLOWED_ADMIN_EMAIL) {
    showDashboard();
    watchPendingPosts();
    watchApprovedPosts();
  } else {
    showLogin();
  }
});