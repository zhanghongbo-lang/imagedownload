import { platformNames, sanitizeFilename } from '../shared/platforms';
import { getSession, saveSession } from '../shared/storage';
import { createZip } from '../shared/zip';
import type { ZipEntry } from '../shared/zip';
import type {
  DownloadProgress,
  GalleryData,
  GalleryPayload,
  GetSizesResult,
  ImageItem,
  ToAppMessage,
  ToBackgroundMessage,
} from '../shared/types';

const CONCURRENCY = 3;

chrome.runtime.onMessage.addListener(
  (raw: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): boolean => {
    const message = raw as ToBackgroundMessage;

    switch (message.type) {
      case 'open-gallery':
        void handleOpenGallery(message.data);
        sendResponse({ ok: true });
        return false;

      case 'download-images':
        void handleDownload(message.sessionId, message.images);
        sendResponse({ ok: true });
        return false;

      case 'get-sizes':
        void handleGetSizes(message.urls).then(sendResponse);
        return true;

      default:
        return false;
    }
  },
);

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function handleOpenGallery(payload: GalleryPayload): Promise<void> {
  const sessionId = generateSessionId();
  const gallery: GalleryData = { sessionId, ...payload };
  await saveSession(gallery);
  const url = `${chrome.runtime.getURL('app/index.html')}?session=${encodeURIComponent(sessionId)}`;
  await chrome.tabs.create({ url });
}

async function handleDownload(sessionId: string, images: ImageItem[]): Promise<void> {
  const gallery = await getSession(sessionId);
  const meta = gallery?.meta;
  const platformName = platformNames[meta?.platform ?? 'unknown'];
  const title = sanitizeFilename(meta?.pageTitle ?? '商品图片').slice(0, 40) || 'images';
  const referrer = meta?.pageUrl ?? '';

  const total = images.length;
  const progress: DownloadProgress = {
    total,
    done: 0,
    succeeded: 0,
    failed: 0,
    currentUrl: '',
    status: 'running',
  };
  sendProgress(sessionId, progress);

  // Fetch + convert every image to PNG first, keeping results in order.
  const results: Array<ZipEntry | null> = new Array<ZipEntry | null>(total).fill(null);

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < total) {
      const index = cursor;
      cursor += 1;
      const item = images[index];
      progress.currentUrl = item.url;
      const name = `${platformName}_${title}_${String(index + 1).padStart(3, '0')}.png`;
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

  const succeeded = results.filter((entry): entry is ZipEntry => entry !== null);

  if (succeeded.length > 0) {
    try {
      if (succeeded.length === 1) {
        const dataUrl = await blobToDataUrl(new Blob([succeeded[0].data], { type: 'image/png' }));
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

  progress.status = 'finished';
  sendProgress(sessionId, progress);
}

function sendProgress(sessionId: string, progress: DownloadProgress): void {
  const message: ToAppMessage = {
    type: 'download-progress',
    sessionId,
    progress: { ...progress },
  };
  chrome.runtime.sendMessage(message).catch(() => {
    // no listener (e.g. gallery closed) — ignore
  });
}

async function fetchImage(url: string, referrer: string): Promise<ArrayBuffer> {
  let response = await fetch(url, { referrer, credentials: 'omit' });
  if (!response.ok) {
    response = await fetch(url, { credentials: 'omit' });
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.arrayBuffer();
}

async function toPng(buffer: ArrayBuffer): Promise<Blob> {
  const bitmap = await createImageBitmap(new Blob([buffer]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('OffscreenCanvas 2D context unavailable');
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/png' });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function handleGetSizes(urls: string[]): Promise<GetSizesResult> {
  const lengths = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD', credentials: 'omit' });
        const header = response.headers.get('content-length');
        if (!header) return null;
        const value = parseInt(header, 10);
        return Number.isFinite(value) ? value : null;
      } catch {
        return null;
      }
    }),
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
