// src/shared/platforms.ts
var platformNames = {
  taobao: "\u6DD8\u5B9D",
  jd: "\u4EAC\u4E1C",
  pinduoduo: "\u62FC\u591A\u591A",
  unknown: "\u7535\u5546"
};
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|\n\r\t]/g, "_").replace(/\s+/g, " ").trim();
}

// src/shared/storage.ts
function sessionKey(sessionId) {
  return `gallery:${sessionId}`;
}
async function saveSession(data) {
  await chrome.storage.session.set({ [sessionKey(data.sessionId)]: data });
}
async function getSession(sessionId) {
  const key = sessionKey(sessionId);
  const result = await chrome.storage.session.get(key);
  const value = result[key];
  return value ?? null;
}

// src/shared/zip.ts
var encoder = new TextEncoder();
var crcTable;
function crc32(data) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < data.length; i++) crc = crc >>> 8 ^ crcTable[(crc ^ data[i]) & 255];
  return (crc ^ -1) >>> 0;
}
function dosDateTime(now) {
  const time = (now.getHours() & 31) << 11 | (now.getMinutes() & 63) << 5 | Math.floor(now.getSeconds() / 2) & 31;
  const date = (now.getFullYear() - 1980 & 127) << 9 | (now.getMonth() + 1 & 15) << 5 | now.getDate() & 31;
  return { time, date };
}
function createZip(entries) {
  const now = dosDateTime(/* @__PURE__ */ new Date());
  const parts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = buildLocalHeader(nameBytes, crc, entry.data.length, now);
    parts.push(local, entry.data);
    centralParts.push(buildCentralHeader(nameBytes, crc, entry.data.length, offset, now));
    offset += local.length + entry.data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = buildEndOfCentralDirectory(entries.length, centralSize, offset);
  return new Blob([...parts, ...centralParts, end], { type: "application/zip" });
}
function buildLocalHeader(nameBytes, crc, size, now) {
  const buf = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 67324752, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 2048, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, now.time, true);
  view.setUint16(12, now.date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  buf.set(nameBytes, 30);
  return buf;
}
function buildCentralHeader(nameBytes, crc, size, offset, now) {
  const buf = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 33639248, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 2048, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, now.time, true);
  view.setUint16(14, now.date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  buf.set(nameBytes, 46);
  return buf;
}
function buildEndOfCentralDirectory(count, centralSize, offset) {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 101010256, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, offset, true);
  view.setUint16(20, 0, true);
  return buf;
}

// src/background/index.ts
var CONCURRENCY = 3;
chrome.runtime.onMessage.addListener(
  (raw, _sender, sendResponse) => {
    const message = raw;
    switch (message.type) {
      case "open-gallery":
        void handleOpenGallery(message.data);
        sendResponse({ ok: true });
        return false;
      case "download-images":
        void handleDownload(message.sessionId, message.images);
        sendResponse({ ok: true });
        return false;
      case "get-sizes":
        void handleGetSizes(message.urls).then(sendResponse);
        return true;
      default:
        return false;
    }
  }
);
function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
async function handleOpenGallery(payload) {
  const sessionId = generateSessionId();
  const gallery = { sessionId, ...payload };
  await saveSession(gallery);
  const url = `${chrome.runtime.getURL("app/index.html")}?session=${encodeURIComponent(sessionId)}`;
  await chrome.tabs.create({ url });
}
async function handleDownload(sessionId, images) {
  const gallery = await getSession(sessionId);
  const meta = gallery?.meta;
  const platformName = platformNames[meta?.platform ?? "unknown"];
  const title = sanitizeFilename(meta?.pageTitle ?? "\u5546\u54C1\u56FE\u7247").slice(0, 40) || "images";
  const referrer = meta?.pageUrl ?? "";
  const total = images.length;
  const progress = {
    total,
    done: 0,
    succeeded: 0,
    failed: 0,
    currentUrl: "",
    status: "running"
  };
  sendProgress(sessionId, progress);
  const results = new Array(total).fill(null);
  let cursor = 0;
  const worker = async () => {
    while (cursor < total) {
      const index = cursor;
      cursor += 1;
      const item = images[index];
      progress.currentUrl = item.url;
      const name = `${platformName}_${title}_${String(index + 1).padStart(3, "0")}.png`;
      try {
        const buffer = await fetchImage(item.url, referrer);
        const pngBlob = await toPng(buffer);
        results[index] = { name, data: new Uint8Array(await pngBlob.arrayBuffer()) };
        progress.succeeded += 1;
      } catch {
        progress.failed += 1;
      }
      progress.done += 1;
      sendProgress(sessionId, progress);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));
  const succeeded = results.filter((entry) => entry !== null);
  if (succeeded.length > 0) {
    try {
      if (succeeded.length === 1) {
        const dataUrl = await blobToDataUrl(new Blob([succeeded[0].data], { type: "image/png" }));
        await chrome.downloads.download({ url: dataUrl, filename: succeeded[0].name });
      } else {
        const zipBlob = createZip(succeeded);
        const dataUrl = await blobToDataUrl(zipBlob);
        await chrome.downloads.download({ url: dataUrl, filename: `${platformName}_${title}.zip` });
      }
    } catch {
      progress.failed = total;
      progress.succeeded = 0;
    }
  }
  progress.status = "finished";
  sendProgress(sessionId, progress);
}
function sendProgress(sessionId, progress) {
  const message = {
    type: "download-progress",
    sessionId,
    progress: { ...progress }
  };
  chrome.runtime.sendMessage(message).catch(() => {
  });
}
async function fetchImage(url, referrer) {
  let response = await fetch(url, { referrer, credentials: "omit" });
  if (!response.ok) {
    response = await fetch(url, { credentials: "omit" });
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.arrayBuffer();
}
async function toPng(buffer) {
  const bitmap = await createImageBitmap(new Blob([buffer]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("OffscreenCanvas 2D context unavailable");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/png" });
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
async function handleGetSizes(urls) {
  const lengths = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { method: "HEAD", credentials: "omit" });
        const header = response.headers.get("content-length");
        if (!header) return null;
        const value = parseInt(header, 10);
        return Number.isFinite(value) ? value : null;
      } catch {
        return null;
      }
    })
  );
  let totalBytes = 0;
  let knownCount = 0;
  for (const length of lengths) {
    if (length !== null) {
      totalBytes += length;
      knownCount += 1;
    }
  }
  return { totalBytes, knownCount, totalCount: urls.length };
}
