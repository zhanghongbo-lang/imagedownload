"use strict";
(() => {
  // src/content/button.ts
  var ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`;
  var STYLE = `
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
  function createExtractButton(onClick) {
    const host = document.createElement("div");
    host.setAttribute("data-img-extractor", "");
    host.style.cssText = "position: fixed; right: 24px; bottom: 32px; z-index: 2147483647;";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `${ICON}<span>\u83B7\u53D6\u56FE\u7247</span>`;
    button.addEventListener("click", onClick);
    const toast = document.createElement("div");
    toast.className = "toast";
    shadow.append(style, button, toast);
    document.documentElement.appendChild(host);
    let toastTimer;
    return {
      destroy: () => host.remove(),
      showMessage: (text) => {
        toast.textContent = text;
        toast.classList.add("is-visible");
        if (toastTimer !== void 0) window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
      }
    };
  }

  // src/shared/platforms.ts
  function detectPlatform(host) {
    if (host.includes("taobao.com") || host.includes("tmall.com")) return "taobao";
    if (host.includes("jd.com")) return "jd";
    if (host.includes("pinduoduo.com") || host.includes("yangkeduo.com")) return "pinduoduo";
    return "unknown";
  }
  function normalizeImageUrl(raw) {
    let url = raw.trim();
    if (!url) return url;
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("http://")) url = "https://" + url.slice("http://".length);
    if (!url.startsWith("https://") && !url.startsWith("http://")) return url;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return url;
    }
    const host = parsed.hostname.toLowerCase();
    if (host.includes("alicdn.com") || host.includes("taobaocdn.com")) {
      parsed.pathname = stripAlicdnResize(parsed.pathname);
    } else if (host.includes("360buyimg.com")) {
      parsed.pathname = parsed.pathname.replace(/\/n\d+\/s\d+x\d+_/i, "/n0/");
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  }
  function stripAlicdnResize(pathname) {
    let path = pathname;
    path = path.replace(/\.webp$/i, "");
    path = path.replace(/[_.]$/, "");
    path = path.replace(/_\d+x\d+(?:q\d+)?\.(?:jpg|jpeg|png)$/i, "");
    path = path.replace(/_\d+x\d+(?:q\d+)?$/i, "");
    path = path.replace(/!q\d+$/i, "");
    return path;
  }

  // src/content/extract.ts
  var SRC_ATTRS = [
    "data-src",
    "data-lazy-src",
    "data-original",
    "data-ks-lazyload",
    "data-lazyload",
    "data-hi-res",
    "data-image",
    "data-url",
    "src"
  ];
  var SKIP_KEYWORDS = [
    "logo",
    "icon",
    "avatar",
    "favicon",
    "beacon",
    "analytics",
    "sprite",
    "qrcode",
    "erweima",
    "loading",
    "blank",
    "placeholder",
    "iconfont",
    "guanggao",
    "banner-ad",
    "ad_",
    "tracking",
    "pixel",
    "1x1"
  ];
  var CONTAINER_SELECTORS = {
    taobao: ["#J_UlThumb", "#J_ImgBooth", "#J_DivItemDesc", ".tb-gallery", ".tb-detail-hd", "#description"],
    jd: ["#spec-list", "#spec-img", "#J-detail-content", ".detail", ".product-detail", "#J-detail-pop-tpl-top"],
    pinduoduo: [".goods-detail", "._goods-detail", "#goods-detail", ".detail-content", ".goods-gallery"],
    unknown: []
  };
  function extractImages() {
    const platform = detectPlatform(location.hostname);
    const map = /* @__PURE__ */ new Map();
    const addElement = (el) => {
      const url = pickBestUrl(el);
      if (!url) return;
      const normalized = normalizeImageUrl(url);
      if (!isUsable(normalized)) return;
      if (isSkippable(normalized)) return;
      if (!isLikelyProductImage(el)) return;
      if (!map.has(normalized)) {
        map.set(normalized, {
          id: `img-${String(map.size + 1).padStart(3, "0")}`,
          url: normalized,
          thumb: normalized,
          ...readSize(el)
        });
      }
    };
    for (const selector of CONTAINER_SELECTORS[platform]) {
      document.querySelectorAll(selector).forEach((container) => {
        container.querySelectorAll("img").forEach(addElement);
      });
    }
    document.querySelectorAll("img").forEach(addElement);
    return { platform, images: Array.from(map.values()) };
  }
  function pickBestUrl(el) {
    for (const attr of SRC_ATTRS) {
      const value = el.getAttribute(attr);
      if (value && value.trim()) return value.trim();
    }
    return null;
  }
  function isUsable(url) {
    return url.startsWith("https://") || url.startsWith("http://");
  }
  function isSkippable(url) {
    const lower = url.toLowerCase();
    return SKIP_KEYWORDS.some((keyword) => lower.includes(keyword));
  }
  function isLikelyProductImage(el) {
    const w = readAttrInt(el, "width");
    const h = readAttrInt(el, "height");
    if (w !== null && h !== null && (w < 100 || h < 100)) return false;
    const img = el;
    if (img.naturalWidth > 0 && img.naturalWidth < 100) return false;
    return true;
  }
  function readSize(el) {
    const w = readAttrInt(el, "width");
    const h = readAttrInt(el, "height");
    if (w !== null && h !== null && w >= 100 && h >= 100) return { width: w, height: h };
    const img = el;
    if (img.naturalWidth >= 100 && img.naturalHeight >= 100) {
      return { width: img.naturalWidth, height: img.naturalHeight };
    }
    return {};
  }
  function readAttrInt(el, name) {
    const raw = el.getAttribute(name);
    if (!raw) return null;
    const value = parseInt(raw, 10);
    return Number.isFinite(value) ? value : null;
  }

  // src/content/index.ts
  function isDetailPage() {
    const { hostname, pathname } = location;
    if (hostname.startsWith("item.")) return true;
    if (pathname.includes("/item")) return true;
    if (pathname.includes("goods.html") || pathname.includes("goods_detail")) return true;
    return false;
  }
  function main() {
    if (!isDetailPage()) return;
    const handle = createExtractButton(() => {
      const { platform, images } = extractImages();
      if (images.length === 0) {
        handle.showMessage("\u672A\u63D0\u53D6\u5230\u56FE\u7247\uFF0C\u8BF7\u786E\u8BA4\u5F53\u524D\u662F\u5546\u54C1\u8BE6\u60C5\u9875");
        return;
      }
      const message = {
        type: "open-gallery",
        data: {
          meta: {
            platform,
            pageTitle: document.title,
            pageUrl: location.href
          },
          images
        }
      };
      chrome.runtime.sendMessage(message).catch(() => {
        handle.showMessage("\u6253\u5F00\u56FE\u7247\u5E93\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
      });
    });
  }
  main();
})();
