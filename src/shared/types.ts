export type Platform = 'taobao' | 'jd' | 'pinduoduo' | 'unknown';

export interface ImageItem {
  id: string;
  /** Normalized full-size image URL (used for download). */
  url: string;
  /** Thumbnail URL for display; equals url for now. */
  thumb: string;
  width?: number;
  height?: number;
}

export interface GalleryMeta {
  platform: Platform;
  pageTitle: string;
  pageUrl: string;
}

export interface GalleryPayload {
  meta: GalleryMeta;
  images: ImageItem[];
}

export interface GalleryData extends GalleryPayload {
  sessionId: string;
}

export interface DownloadProgress {
  total: number;
  done: number;
  succeeded: number;
  failed: number;
  currentUrl: string;
  status: 'running' | 'finished';
}

export interface GetSizesResult {
  totalBytes: number;
  knownCount: number;
  totalCount: number;
}

/** Messages sent to the background service worker. */
export type ToBackgroundMessage =
  | { type: 'open-gallery'; data: GalleryPayload }
  | { type: 'download-images'; sessionId: string; images: ImageItem[] }
  | { type: 'get-sizes'; urls: string[] };

/** Messages the background broadcasts to extension pages. */
export type ToAppMessage = {
  type: 'download-progress';
  sessionId: string;
  progress: DownloadProgress;
};
