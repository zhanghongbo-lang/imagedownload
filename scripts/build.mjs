import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// static assets: manifest.json + icons
cpSync(resolve(root, 'public'), dist, { recursive: true });

// app page static files (html + css)
mkdirSync(resolve(dist, 'app'), { recursive: true });
cpSync(resolve(root, 'src/app/index.html'), resolve(dist, 'app/index.html'));
cpSync(resolve(root, 'src/app/styles.css'), resolve(dist, 'app/styles.css'));

const common = {
  bundle: true,
  target: 'chrome110',
  minify: false,
  sourcemap: false,
  logLevel: 'info',
};

// content script (classic IIFE — content scripts cannot be ES modules)
await build({
  ...common,
  entryPoints: [resolve(root, 'src/content/index.ts')],
  outfile: resolve(dist, 'content.js'),
  format: 'iife',
});

// background service worker (ES module)
await build({
  ...common,
  entryPoints: [resolve(root, 'src/background/index.ts')],
  outfile: resolve(dist, 'background.js'),
  format: 'esm',
});

// gallery page script (IIFE, bundled)
await build({
  ...common,
  entryPoints: [resolve(root, 'src/app/main.ts')],
  outfile: resolve(dist, 'app/app.js'),
  format: 'iife',
});

console.log('Build complete -> dist/');
