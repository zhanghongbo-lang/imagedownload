import { createImageCard } from '../components/imageCard';
import type { ImageCardHandle } from '../components/imageCard';
import { openPreview } from '../components/previewModal';
import { createToolbar } from '../components/toolbar';
import type { ToolbarHandle } from '../components/toolbar';
import { formatBytes } from '../shared/format';
import { getSession } from '../shared/storage';
import type {
  GalleryData,
  GetSizesResult,
  ImageItem,
  ToAppMessage,
  ToBackgroundMessage,
} from '../shared/types';

const sessionId = new URLSearchParams(location.search).get('session');
const headerEl = document.getElementById('app-header');
const mainEl = document.getElementById('app-main');
const previewRoot = document.getElementById('preview-root');

let gallery: GalleryData | null = null;
let toolbar: ToolbarHandle | null = null;
const cardHandles = new Map<string, ImageCardHandle>();
const selectedIds = new Set<string>();

function init(): void {
  if (!sessionId || !headerEl || !mainEl) {
    renderEmptyState();
    return;
  }
  void load();
}

async function load(): Promise<void> {
  if (!sessionId) return;
  gallery = await getSession(sessionId);
  if (!gallery) {
    renderEmptyState();
    return;
  }
  render();
  void computeTotalSize();
}

function render(): void {
  if (!gallery || !headerEl || !mainEl) return;
  headerEl.innerHTML = '';
  mainEl.innerHTML = '';

  toolbar = createToolbar({
    platform: gallery.meta.platform,
    title: gallery.meta.pageTitle,
    onSelectAll: selectAll,
    onClearSelection: clearSelection,
    onDownloadSelected: downloadSelected,
    onDownloadAll: downloadAll,
  });
  headerEl.appendChild(toolbar.el);

  const grid = document.createElement('div');
  grid.className = 'image-grid';

  cardHandles.clear();
  for (const item of gallery.images) {
    const card = createImageCard(item, selectedIds.has(item.id), onToggle, onPreview);
    cardHandles.set(item.id, card);
    grid.appendChild(card.el);
  }
  mainEl.appendChild(grid);

  toolbar.setCounts(gallery.images.length, selectedIds.size);
  toolbar.setDownloadEnabled(selectedIds.size > 0);
}

function onToggle(item: ImageItem, selected: boolean): void {
  if (selected) selectedIds.add(item.id);
  else selectedIds.delete(item.id);
  syncToolbar();
}

function onPreview(item: ImageItem): void {
  if (!previewRoot) return;
  openPreview(item.url, previewRoot);
}

function selectAll(): void {
  if (!gallery) return;
  for (const item of gallery.images) selectedIds.add(item.id);
  syncCards();
  syncToolbar();
}

function clearSelection(): void {
  selectedIds.clear();
  syncCards();
  syncToolbar();
}

function downloadSelected(): void {
  if (!gallery || selectedIds.size === 0) return;
  const images = gallery.images.filter((item) => selectedIds.has(item.id));
  startDownload(images);
}

function downloadAll(): void {
  if (!gallery) return;
  startDownload(gallery.images);
}

function startDownload(images: ImageItem[]): void {
  if (!sessionId) return;
  const message: ToBackgroundMessage = { type: 'download-images', sessionId, images };
  void chrome.runtime.sendMessage(message);
}

function syncCards(): void {
  cardHandles.forEach((card, id) => card.setSelected(selectedIds.has(id)));
}

function syncToolbar(): void {
  if (!toolbar || !gallery) return;
  toolbar.setCounts(gallery.images.length, selectedIds.size);
  toolbar.setDownloadEnabled(selectedIds.size > 0);
}

async function computeTotalSize(): Promise<void> {
  if (!gallery || !toolbar) return;
  const message: ToBackgroundMessage = { type: 'get-sizes', urls: gallery.images.map((item) => item.url) };
  const result = (await chrome.runtime.sendMessage(message)) as GetSizesResult | undefined;
  if (!result || result.knownCount === 0) {
    toolbar.setSize('大小 未知');
    return;
  }
  toolbar.setSize(`约 ${formatBytes(result.totalBytes)}`);
}

function renderEmptyState(): void {
  if (!mainEl) return;
  mainEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  const heading = document.createElement('h2');
  heading.textContent = '暂无图片';
  const text = document.createElement('p');
  text.textContent = '请在淘宝 / 京东 / 拼多多的商品详情页点击右下角「获取图片」按钮。';
  wrap.append(heading, text);
  mainEl.appendChild(wrap);
}

chrome.runtime.onMessage.addListener((raw: unknown): void => {
  const message = raw as ToAppMessage;
  if (message.type === 'download-progress' && message.sessionId === sessionId) {
    toolbar?.setProgress(message.progress);
  }
});

init();
