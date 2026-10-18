# 电商图片提取下载（Chrome 扩展）

在淘宝、京东、拼多多的商品详情页一键提取所有商品图片，在新页面中查看、勾选并批量下载为 PNG 格式。

## 功能

- 商品详情页右下角注入「获取图片」悬浮按钮
- 自动提取详情页所有商品图片（含懒加载图片），过滤图标、logo、头像等无关图片
- 新标签页网格展示，支持单选 / 全选 / 取消全选 / 点击放大预览（Esc 关闭）
- 下载为 PNG 格式：下载 1 张直接保存为 `.png`，下载多张自动打包为一个 `.zip` 压缩包
- 显示图片总数、已选数量、总大小与下载进度

## 技术栈

- Chrome Manifest V3
- TypeScript（strict）
- esbuild 打包（无运行时框架依赖）

## 目录结构

```
public/manifest.json        扩展清单
public/icons/               扩展图标（脚本生成）
scripts/build.mjs           构建脚本
scripts/gen-icons.mjs       图标生成脚本
src/shared/                 共享类型与工具（平台识别、URL 归一化、存储、ZIP 打包）
src/content/                内容脚本（注入按钮 + 图片提取）
src/background/             后台 Service Worker（抓取、转 PNG、下载）
src/app/                    图片库页面（HTML / CSS / 逻辑）
src/components/             图片库 UI 组件（卡片、工具栏、预览）
```

## 安装（开发者模式）

1. 安装依赖并构建：

   ```bash
   pnpm install
   pnpm build
   ```

2. 打开 Chrome，进入 `chrome://extensions`。
3. 打开右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择本项目的 `dist` 目录。

## 使用

1. 打开淘宝、京东或拼多多的某个商品详情页。
2. 点击页面右下角的「获取图片」按钮。
3. 在新打开的图片库页面勾选需要下载的图片，点击「下载所选」或「下载全部」。

## 说明

- 图片统一转码为 PNG：跨域图片在后台 Service Worker 中通过 `fetch` 获取二进制，再用 `OffscreenCanvas` 解码并重编码为 PNG。
- 多张图片打包为 ZIP：使用内置零依赖的 `src/shared/zip.ts` 生成 ZIP（STORE 方式，中文文件名按 UTF-8 编码，跨平台解压不乱码）。
- 若某个平台的部分图片因防盗链或非白名单 CDN 无法下载，可在 `public/manifest.json` 的 `host_permissions` 中补充对应域名。
- 开发命令：

  ```bash
  pnpm typecheck   # 类型检查
  pnpm icons       # 重新生成图标
  pnpm build       # 构建到 dist/
  ```
