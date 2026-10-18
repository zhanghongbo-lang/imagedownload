export interface PreviewHandle {
  close: () => void;
}

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

export function openPreview(url: string, root: HTMLElement): PreviewHandle {
  const overlay = document.createElement('div');
  overlay.className = 'preview-overlay';

  const img = document.createElement('img');
  img.src = url;
  img.alt = '预览';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'preview-close';
  closeButton.innerHTML = CLOSE_ICON;
  closeButton.setAttribute('aria-label', '关闭预览');

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  overlay.append(img, closeButton);
  root.appendChild(overlay);

  return { close };
}
