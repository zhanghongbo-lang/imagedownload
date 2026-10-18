"use strict";
(() => {
  // src/components/imageCard.ts
  var ZOOM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>`;
  function createImageCard(item, isSelected, onToggle2, onPreview2) {
    const card = document.createElement("div");
    card.className = "image-card" + (isSelected ? " is-selected" : "");
    card.dataset.id = item.id;
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = item.thumb;
    img.alt = item.id;
    img.addEventListener("click", () => onPreview2(item));
    const check = document.createElement("label");
    check.className = "image-card__check";
    check.title = "\u9009\u62E9";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isSelected;
    checkbox.addEventListener("change", () => onToggle2(item, checkbox.checked));
    const mark = document.createElement("span");
    mark.className = "image-card__mark";
    check.append(checkbox, mark);
    const zoom = document.createElement("div");
    zoom.className = "image-card__zoom";
    zoom.innerHTML = ZOOM_ICON;
    zoom.addEventListener("click", (event) => {
      event.stopPropagation();
      onPreview2(item);
    });
    card.append(img, check, zoom);
    return {
      el: card,
      setSelected: (selected) => {
        card.classList.toggle("is-selected", selected);
        checkbox.checked = selected;
      }
    };
  }

  // src/components/previewModal.ts
  var CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  function openPreview(url, root) {
    const overlay = document.createElement("div");
    overlay.className = "preview-overlay";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "\u9884\u89C8";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "preview-close";
    closeButton.innerHTML = CLOSE_ICON;
    closeButton.setAttribute("aria-label", "\u5173\u95ED\u9884\u89C8");
    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKeydown);
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") close();
    };
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    closeButton.addEventListener("click", close);
    document.addEventListener("keydown", onKeydown);
    overlay.append(img, closeButton);
    root.appendChild(overlay);
    return { close };
  }

  // src/shared/platforms.ts
  var platformNames = {
    taobao: "\u6DD8\u5B9D",
    jd: "\u4EAC\u4E1C",
    pinduoduo: "\u62FC\u591A\u591A",
    unknown: "\u7535\u5546"
  };

  // src/shared/format.ts
  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "\u672A\u77E5";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let value = bytes;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }
  function truncate(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max) + "\u2026";
  }

  // src/components/toolbar.ts
  function createToolbar(options) {
    const el = document.createElement("div");
    el.className = "app-header-inner";
    const left = document.createElement("div");
    left.className = "app-header__left";
    const title = document.createElement("h1");
    title.className = "app-title";
    title.textContent = "\u56FE\u7247\u63D0\u53D6\u7ED3\u679C";
    const subtitle = document.createElement("p");
    subtitle.className = "app-subtitle";
    subtitle.textContent = `${platformNames[options.platform]} \xB7 ${truncate(options.title, 48)}`;
    left.append(title, subtitle);
    const stats = document.createElement("div");
    stats.className = "app-header__stats";
    const statTotal = document.createElement("div");
    statTotal.className = "stat";
    const statSelected = document.createElement("div");
    statSelected.className = "stat";
    const statSize = document.createElement("div");
    statSize.className = "stat";
    stats.append(statTotal, statSelected, statSize);
    const actions = document.createElement("div");
    actions.className = "app-header__actions";
    const btnSelectAll = makeButton("\u5168\u9009", "ghost", options.onSelectAll);
    const btnClear = makeButton("\u53D6\u6D88\u5168\u9009", "ghost", options.onClearSelection);
    const btnDownloadSelected = makeButton("\u4E0B\u8F7D\u6240\u9009", "primary", options.onDownloadSelected);
    const btnDownloadAll = makeButton("\u4E0B\u8F7D\u5168\u90E8", "outline", options.onDownloadAll);
    actions.append(btnSelectAll, btnClear, btnDownloadSelected, btnDownloadAll);
    const progress = document.createElement("div");
    progress.className = "progress";
    progress.hidden = true;
    const progressBar = document.createElement("div");
    progressBar.className = "progress__bar";
    const progressFill = document.createElement("div");
    progressFill.className = "progress__fill";
    progressBar.appendChild(progressFill);
    const progressText = document.createElement("div");
    progressText.className = "progress__text";
    progress.append(progressBar, progressText);
    el.append(left, stats, actions, progress);
    const setCounts = (total, selected) => {
      statTotal.innerHTML = `\u5171 <b>${total}</b> \u5F20`;
      statSelected.innerHTML = `\u5DF2\u9009 <b>${selected}</b> \u5F20`;
    };
    const setSize = (text) => {
      statSize.textContent = text;
    };
    const setProgress = (value) => {
      if (!value) {
        progress.hidden = true;
        return;
      }
      progress.hidden = false;
      if (value.status === "finished") {
        progressFill.style.width = "100%";
        progressText.textContent = `\u4E0B\u8F7D\u5B8C\u6210\uFF1A\u6210\u529F ${value.succeeded}\uFF0C\u5931\u8D25 ${value.failed}`;
      } else {
        const percent = value.total > 0 ? Math.round(value.done / value.total * 100) : 0;
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `\u4E0B\u8F7D\u4E2D ${value.done}/${value.total}\uFF08\u6210\u529F ${value.succeeded}\uFF0C\u5931\u8D25 ${value.failed}\uFF09`;
      }
    };
    const setDownloadEnabled = (enabled) => {
      btnDownloadSelected.disabled = !enabled;
    };
    return { el, setCounts, setSize, setProgress, setDownloadEnabled };
  }
  function makeButton(label, variant, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn btn--${variant}`;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  // src/shared/storage.ts
  function sessionKey(sessionId2) {
    return `gallery:${sessionId2}`;
  }
  async function getSession(sessionId2) {
    const key = sessionKey(sessionId2);
    const result = await chrome.storage.session.get(key);
    const value = result[key];
    return value ?? null;
  }

  // src/app/main.ts
  var sessionId = new URLSearchParams(location.search).get("session");
  var headerEl = document.getElementById("app-header");
  var mainEl = document.getElementById("app-main");
  var previewRoot = document.getElementById("preview-root");
  var gallery = null;
  var toolbar = null;
  var cardHandles = /* @__PURE__ */ new Map();
  var selectedIds = /* @__PURE__ */ new Set();
  function init() {
    if (!sessionId || !headerEl || !mainEl) {
      renderEmptyState();
      return;
    }
    void load();
  }
  async function load() {
    if (!sessionId) return;
    gallery = await getSession(sessionId);
    if (!gallery) {
      renderEmptyState();
      return;
    }
    render();
    void computeTotalSize();
  }
  function render() {
    if (!gallery || !headerEl || !mainEl) return;
    headerEl.innerHTML = "";
    mainEl.innerHTML = "";
    toolbar = createToolbar({
      platform: gallery.meta.platform,
      title: gallery.meta.pageTitle,
      onSelectAll: selectAll,
      onClearSelection: clearSelection,
      onDownloadSelected: downloadSelected,
      onDownloadAll: downloadAll
    });
    headerEl.appendChild(toolbar.el);
    const grid = document.createElement("div");
    grid.className = "image-grid";
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
  function onToggle(item, selected) {
    if (selected) selectedIds.add(item.id);
    else selectedIds.delete(item.id);
    syncToolbar();
  }
  function onPreview(item) {
    if (!previewRoot) return;
    openPreview(item.url, previewRoot);
  }
  function selectAll() {
    if (!gallery) return;
    for (const item of gallery.images) selectedIds.add(item.id);
    syncCards();
    syncToolbar();
  }
  function clearSelection() {
    selectedIds.clear();
    syncCards();
    syncToolbar();
  }
  function downloadSelected() {
    if (!gallery || selectedIds.size === 0) return;
    const images = gallery.images.filter((item) => selectedIds.has(item.id));
    startDownload(images);
  }
  function downloadAll() {
    if (!gallery) return;
    startDownload(gallery.images);
  }
  function startDownload(images) {
    if (!sessionId) return;
    const message = { type: "download-images", sessionId, images };
    void chrome.runtime.sendMessage(message);
  }
  function syncCards() {
    cardHandles.forEach((card, id) => card.setSelected(selectedIds.has(id)));
  }
  function syncToolbar() {
    if (!toolbar || !gallery) return;
    toolbar.setCounts(gallery.images.length, selectedIds.size);
    toolbar.setDownloadEnabled(selectedIds.size > 0);
  }
  async function computeTotalSize() {
    if (!gallery || !toolbar) return;
    const message = { type: "get-sizes", urls: gallery.images.map((item) => item.url) };
    const result = await chrome.runtime.sendMessage(message);
    if (!result || result.knownCount === 0) {
      toolbar.setSize("\u5927\u5C0F \u672A\u77E5");
      return;
    }
    toolbar.setSize(`\u7EA6 ${formatBytes(result.totalBytes)}`);
  }
  function renderEmptyState() {
    if (!mainEl) return;
    mainEl.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "empty-state";
    const heading = document.createElement("h2");
    heading.textContent = "\u6682\u65E0\u56FE\u7247";
    const text = document.createElement("p");
    text.textContent = "\u8BF7\u5728\u6DD8\u5B9D / \u4EAC\u4E1C / \u62FC\u591A\u591A\u7684\u5546\u54C1\u8BE6\u60C5\u9875\u70B9\u51FB\u53F3\u4E0B\u89D2\u300C\u83B7\u53D6\u56FE\u7247\u300D\u6309\u94AE\u3002";
    wrap.append(heading, text);
    mainEl.appendChild(wrap);
  }
  chrome.runtime.onMessage.addListener((raw) => {
    const message = raw;
    if (message.type === "download-progress" && message.sessionId === sessionId) {
      toolbar?.setProgress(message.progress);
    }
  });
  init();
})();
