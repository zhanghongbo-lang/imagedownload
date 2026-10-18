import { createExtractButton } from './button';
import { extractImages } from './extract';
import type { ToBackgroundMessage } from '../shared/types';

function isDetailPage(): boolean {
  const { hostname, pathname } = location;
  if (hostname.startsWith('item.')) return true; // item.jd.com
  if (pathname.includes('/item')) return true; // item.taobao.com / detail.tmall.com
  if (pathname.includes('goods.html') || pathname.includes('goods_detail')) return true; // 拼多多
  return false;
}

function main(): void {
  if (!isDetailPage()) return;

  const handle = createExtractButton(() => {
    const { platform, images } = extractImages();
    if (images.length === 0) {
      handle.showMessage('未提取到图片，请确认当前是商品详情页');
      return;
    }

    const message: ToBackgroundMessage = {
      type: 'open-gallery',
      data: {
        meta: {
          platform,
          pageTitle: document.title,
          pageUrl: location.href,
        },
        images,
      },
    };

    chrome.runtime.sendMessage(message).catch(() => {
      handle.showMessage('打开图片库失败，请重试');
    });
  });
}

main();
