const LOCAL_FRAMES = [
  {
    id: "demo-lny-news",
    title: "Lunar New Year News",
    description: "Khung báo Tết, ảnh lớn ở đầu trang, vibe photobooth sáng rõ.",
    frameUrl: new URL("../frames/HaNoiCycle.png", import.meta.url).href,
    thumbUrl: new URL("../frames/HaNoiCycle.png", import.meta.url).href,
    sortOrder: 1,
    isActive: true,
    source: "demo-local"
  },
  {
    id: "demo-autumn-news",
    title: "Co hen voi mua thu",
    description: "Khung báo mùa thu, bố cục editorial, tone nhẹ và sang.",
    frameUrl: new URL("../frames/demo-autumn-frame.png", import.meta.url).href,
    thumbUrl: new URL("../frames/demo-autumn-frame.png", import.meta.url).href,
    sortOrder: 2,
    isActive: true,
    source: "demo-local"
  }
];

const STORAGE_KEY = "photoBooth:selectedFrame";

let firebaseBundlePromise = null;

function sortFrames(list = []) {
  return [...list].sort((a, b) => {
    const sortA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 9999;
    const sortB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 9999;

    if (sortA !== sortB) return sortA - sortB;

    const createdA = toMillis(a.createdAt);
    const createdB = toMillis(b.createdAt);
    return createdB - createdA;
  });
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function getFirebaseBundle() {
  if (firebaseBundlePromise) return firebaseBundlePromise;

  firebaseBundlePromise = (async () => {
    try {
      const [{ db }, firestore] = await Promise.all([
        import("../../firebase.js"),
        import("https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js")
      ]);

      if (!db) return null;

      return {
        db,
        ...firestore
      };
    } catch (error) {
      console.info("[frame-store] Firebase unavailable, fallback local frames.", error);
      return null;
    }
  })();

  return firebaseBundlePromise;
}

function normalizeFrame(id, data = {}) {
  return {
    id,
    title: data.title || data.name || "Untitled frame",
    description: data.description || "Khung PNG overlay A4.",
    frameUrl: data.frameUrl || data.pngUrl || data.imageUrl || "",
    thumbUrl: data.thumbUrl || data.frameUrl || data.pngUrl || data.imageUrl || "",
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : Number(data.sortOrder || 9999),
    isActive: data.isActive !== false,
    source: data.source || "cloudinary",
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

export function getLocalFrames() {
  return sortFrames(LOCAL_FRAMES);
}

export function saveSelectedFrame(frame) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(frame));
}

export function getSelectedFrameFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("[frame-store] Cannot parse selected frame", error);
    return null;
  }
}

export async function getFrameById(frameId) {
  const fallback = getLocalFrames().find((item) => item.id === frameId) || null;
  const firebase = await getFirebaseBundle();

  if (!firebase || !frameId) return fallback;

  try {
    const { db, doc, getDoc } = firebase;
    const snapshot = await getDoc(doc(db, "photoFrames", frameId));
    if (snapshot.exists()) {
      const frame = normalizeFrame(snapshot.id, snapshot.data());
      return frame.isActive ? frame : fallback;
    }
  } catch (error) {
    console.warn("[frame-store] Firestore getFrameById failed", error);
  }

  return fallback;
}

export async function subscribeFrames(onChange, onError) {
  const fallbackFrames = getLocalFrames();
  const firebase = await getFirebaseBundle();

  if (!firebase) {
    onChange(fallbackFrames);
    return () => {};
  }

  try {
    const { db, collection, onSnapshot } = firebase;

    return onSnapshot(
      collection(db, "photoFrames"),
      (snapshot) => {
        const frames = sortFrames(
          snapshot.docs
            .map((docSnap) => normalizeFrame(docSnap.id, docSnap.data()))
            .filter((item) => item.isActive !== false && item.frameUrl)
        );

        onChange(frames.length ? frames : fallbackFrames);
      },
      (error) => {
        console.warn("[frame-store] Firestore snapshot failed", error);
        if (typeof onError === "function") onError(error);
        onChange(fallbackFrames);
      }
    );
  } catch (error) {
    console.warn("[frame-store] subscribeFrames failed", error);
    if (typeof onError === "function") onError(error);
    onChange(fallbackFrames);
    return () => {};
  }
}

export function buildBoothUrl(frame) {
  const url = new URL("../../booth.html", import.meta.url);
  url.searchParams.set("frameId", frame.id);
  return url.pathname + url.search;
}

