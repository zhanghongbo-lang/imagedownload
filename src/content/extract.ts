import { detectPlatform, normalizeImageUrl } from '../shared/platforms';
import type { ImageItem, Platform } from '../shared/types';

const SRC_ATTRS = [
  'data-src',
  'data-lazy-src',
  'data-original',
  'data-ks-lazyload',
  'data-lazyload',
  'data-hi-res',
  'data-image',
  'data-url',
  'src',
] as const;

const SKIP_KEYWORDS = [
  'logo',
  'icon',
  'avatar',
  'favicon',
  'beacon',
  'analytics',
  'sprite',
  'qrcode',
  'erweima',
  'loading',
  'blank',
  'placeholder',
  'iconfont',
  'guanggao',
  'banner-ad',
  'ad_',
  'tracking',
  'pixel',
  '1x1',
];

const CONTAINER_SELECTORS: Record<Platform, string[]> = {
  taobao: ['#J_UlThumb', '#J_ImgBooth', '#J_DivItemDesc', '.tb-gallery', '.tb-detail-hd', '#description'],
  jd: ['#spec-list', '#spec-img', '#J-detail-content', '.detail', '.product-detail', '#J-detail-pop-tpl-top'],
  pinduoduo: ['.goods-detail', '._goods-detail', '#goods-detail', '.detail-content', '.goods-gallery'],
  unknown: [],
};

export interface ExtractResult {
  platform: Platform;
  images: ImageItem[];
}

export function extractImages(): ExtractResult {
  const platform = detectPlatform(location.hostname);
  const map = new Map<string, ImageItem>();

  const addElement = (el: Element): void => {
    const url = pickBestUrl(el);
    if (!url) return;
    const normalized = normalizeImageUrl(url);
    if (!isUsable(normalized)) return;
    if (isSkippable(normalized)) return;
    if (!isLikelyProductImage(el)) return;
    if (!map.has(normalized)) {
      map.set(normalized, {
        id: `img-${String(map.size + 1).padStart(3, '0')}`,
        url: normalized,
        thumb: normalized,
        ...readSize(el),
      });
    }
  };

  // 1) platform-specific containers first (keeps meaningful images early)
  for (const selector of CONTAINER_SELECTORS[platform]) {
    document.querySelectorAll(selector).forEach((container) => {
      container.querySelectorAll('img').forEach(addElement);
    });
  }

  // 2) global scan for images outside known containers
  document.querySelectorAll('img').forEach(addElement);

  return { platform, images: Array.from(map.values()) };
}

function pickBestUrl(el: Element): string | null {
  for (const attr of SRC_ATTRS) {
    const value = el.getAttribute(attr);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function isUsable(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

function isSkippable(url: string): boolean {
  const lower = url.toLowerCase();
  return SKIP_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function isLikelyProductImage(el: Element): boolean {
  const w = readAttrInt(el, 'width');
  const h = readAttrInt(el, 'height');
  if (w !== null && h !== null && (w < 100 || h < 100)) return false;
  const img = el as HTMLImageElement;
  if (img.naturalWidth > 0 && img.naturalWidth < 100) return false;
  return true;
}

function readSize(el: Element): { width?: number; height?: number } {
  const w = readAttrInt(el, 'width');
  const h = readAttrInt(el, 'height');
  if (w !== null && h !== null && w >= 100 && h >= 100) return { width: w, height: h };
  const img = el as HTMLImageElement;
  if (img.naturalWidth >= 100 && img.naturalHeight >= 100) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
  return {};
}

function readAttrInt(el: Element, name: string): number | null {
  const raw = el.getAttribute(name);
  if (!raw) return null;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}
