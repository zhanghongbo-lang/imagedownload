import type { Platform } from './types';

export function detectPlatform(host: string): Platform {
  if (host.includes('taobao.com') || host.includes('tmall.com')) return 'taobao';
  if (host.includes('jd.com')) return 'jd';
  if (host.includes('pinduoduo.com') || host.includes('yangkeduo.com')) return 'pinduoduo';
  return 'unknown';
}

export const platformNames: Record<Platform, string> = {
  taobao: '淘宝',
  jd: '京东',
  pinduoduo: '拼多多',
  unknown: '电商',
};

/**
 * Normalize a raw image URL to a full-size https URL.
 * Strips common CDN resize suffixes and query params.
 */
export function normalizeImageUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return url;

  if (url.startsWith('//')) url = 'https:' + url;
  else if (url.startsWith('http://')) url = 'https://' + url.slice('http://'.length);

  if (!url.startsWith('https://') && !url.startsWith('http://')) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const host = parsed.hostname.toLowerCase();

  if (host.includes('alicdn.com') || host.includes('taobaocdn.com')) {
    parsed.pathname = stripAlicdnResize(parsed.pathname);
  } else if (host.includes('360buyimg.com')) {
    // /n1/s450x450_jfs/... -> /n0/jfs/... (n0 = original size)
    parsed.pathname = parsed.pathname.replace(/\/n\d+\/s\d+x\d+_/i, '/n0/');
  }

  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function stripAlicdnResize(pathname: string): string {
  let path = pathname;
  path = path.replace(/\.webp$/i, ''); // ...jpg_400x400q50.jpg_.webp -> ...jpg_400x400q50.jpg_
  path = path.replace(/[_.]$/, ''); // -> ...jpg_400x400q50.jpg
  path = path.replace(/_\d+x\d+(?:q\d+)?\.(?:jpg|jpeg|png)$/i, ''); // -> ...jpg
  path = path.replace(/_\d+x\d+(?:q\d+)?$/i, ''); // ...jpg_400x400 -> ...jpg
  path = path.replace(/!q\d+$/i, ''); // ...!q70 -> ...
  return path;
}

/** Remove characters that are illegal in a file name. */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\n\r\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}
