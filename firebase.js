import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  increment
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCwMKL7wSvyVcBOLb_3Cr-JKKn-JhmvyE8",
  authDomain: "a4blog-a8051.firebaseapp.com",
  projectId: "a4blog-a8051",
  storageBucket: "a4blog-a8051.firebasestorage.app",
  messagingSenderId: "156158826455",
  appId: "1:156158826455:web:6fd16c0bb07febd5d29d92",
  measurementId: "G-S3KYR35T71"
};

const app = initializeApp(firebaseConfig);

// analytics có thể dùng khi chạy trên hosting/domain hợp lệ
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("Analytics is not available in this environment.", error);
}

const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };

export {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  increment
};