import type { GalleryData } from './types';

function sessionKey(sessionId: string): string {
  return `gallery:${sessionId}`;
}

export async function saveSession(data: GalleryData): Promise<void> {
  await chrome.storage.session.set({ [sessionKey(data.sessionId)]: data });
}

export async function getSession(sessionId: string): Promise<GalleryData | null> {
  const key = sessionKey(sessionId);
  const result = await chrome.storage.session.get(key);
  const value = result[key] as unknown as GalleryData | undefined;
  return value ?? null;
}
