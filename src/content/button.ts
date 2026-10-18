export interface ExtractButtonHandle {
  destroy: () => void;
  showMessage: (text: string) => void;
}

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`;

const STYLE = `
  button {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    height: 44px; padding: 0 20px; border: none; border-radius: 22px;
    background: #059669; color: #ffffff;
    font-size: 15px; font-weight: 600; letter-spacing: .5px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    cursor: pointer; box-shadow: 0 6px 20px rgba(5, 150, 105, .35);
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
  }
  button:hover { background: #10b981; box-shadow: 0 8px 24px rgba(5, 150, 105, .45); transform: translateY(-1px); }
  button:active { transform: translateY(0); box-shadow: 0 4px 14px rgba(5, 150, 105, .35); }
  button svg { width: 18px; height: 18px; flex: 0 0 auto; }

  .toast {
    position: fixed; right: 24px; bottom: 92px;
    max-width: 280px; padding: 10px 16px; border-radius: 10px;
    background: rgba(6, 78, 59, .95); color: #fff;
    font-size: 13px; line-height: 1.5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .18);
    opacity: 0; transform: translateY(6px);
    transition: opacity .2s ease, transform .2s ease;
  }
  .toast.is-visible { opacity: 1; transform: translateY(0); }
`;

export function createExtractButton(onClick: () => void): ExtractButtonHandle {
  const host = document.createElement('div');
  host.setAttribute('data-img-extractor', '');
  host.style.cssText = 'position: fixed; right: 24px; bottom: 32px; z-index: 2147483647;';

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLE;

  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `${ICON}<span>获取图片</span>`;
  button.addEventListener('click', onClick);

  const toast = document.createElement('div');
  toast.className = 'toast';

  shadow.append(style, button, toast);
  document.documentElement.appendChild(host);

  let toastTimer: number | undefined;

  return {
    destroy: () => host.remove(),
    showMessage: (text: string) => {
      toast.textContent = text;
      toast.classList.add('is-visible');
      if (toastTimer !== undefined) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
    },
  };
}
