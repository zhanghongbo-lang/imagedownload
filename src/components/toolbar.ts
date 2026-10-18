import { platformNames } from '../shared/platforms';
import { truncate } from '../shared/format';
import type { DownloadProgress, Platform } from '../shared/types';

export interface ToolbarOptions {
  platform: Platform;
  title: string;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDownloadSelected: () => void;
  onDownloadAll: () => void;
}

export interface ToolbarHandle {
  el: HTMLElement;
  setCounts: (total: number, selected: number) => void;
  setSize: (text: string) => void;
  setProgress: (progress: DownloadProgress | null) => void;
  setDownloadEnabled: (enabled: boolean) => void;
}

export function createToolbar(options: ToolbarOptions): ToolbarHandle {
  const el = document.createElement('div');
  el.className = 'app-header-inner';

  const left = document.createElement('div');
  left.className = 'app-header__left';
  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = '图片提取结果';
  const subtitle = document.createElement('p');
  subtitle.className = 'app-subtitle';
  subtitle.textContent = `${platformNames[options.platform]} · ${truncate(options.title, 48)}`;
  left.append(title, subtitle);

  const stats = document.createElement('div');
  stats.className = 'app-header__stats';
  const statTotal = document.createElement('div');
  statTotal.className = 'stat';
  const statSelected = document.createElement('div');
  statSelected.className = 'stat';
  const statSize = document.createElement('div');
  statSize.className = 'stat';
  stats.append(statTotal, statSelected, statSize);

  const actions = document.createElement('div');
  actions.className = 'app-header__actions';
  const btnSelectAll = makeButton('全选', 'ghost', options.onSelectAll);
  const btnClear = makeButton('取消全选', 'ghost', options.onClearSelection);
  const btnDownloadSelected = makeButton('下载所选', 'primary', options.onDownloadSelected);
  const btnDownloadAll = makeButton('下载全部', 'outline', options.onDownloadAll);
  actions.append(btnSelectAll, btnClear, btnDownloadSelected, btnDownloadAll);

  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.hidden = true;
  const progressBar = document.createElement('div');
  progressBar.className = 'progress__bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'progress__fill';
  progressBar.appendChild(progressFill);
  const progressText = document.createElement('div');
  progressText.className = 'progress__text';
  progress.append(progressBar, progressText);

  el.append(left, stats, actions, progress);

  const setCounts = (total: number, selected: number): void => {
    statTotal.innerHTML = `共 <b>${total}</b> 张`;
    statSelected.innerHTML = `已选 <b>${selected}</b> 张`;
  };

  const setSize = (text: string): void => {
    statSize.textContent = text;
  };

  const setProgress = (value: DownloadProgress | null): void => {
    if (!value) {
      progress.hidden = true;
      return;
    }
    progress.hidden = false;
    if (value.status === 'finished') {
      progressFill.style.width = '100%';
      progressText.textContent = `下载完成：成功 ${value.succeeded}，失败 ${value.failed}`;
    } else {
      const percent = value.total > 0 ? Math.round((value.done / value.total) * 100) : 0;
      progressFill.style.width = `${percent}%`;
      progressText.textContent = `下载中 ${value.done}/${value.total}（成功 ${value.succeeded}，失败 ${value.failed}）`;
    }
  };

  const setDownloadEnabled = (enabled: boolean): void => {
    btnDownloadSelected.disabled = !enabled;
  };

  return { el, setCounts, setSize, setProgress, setDownloadEnabled };
}

function makeButton(
  label: string,
  variant: 'primary' | 'outline' | 'ghost',
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn btn--${variant}`;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}
