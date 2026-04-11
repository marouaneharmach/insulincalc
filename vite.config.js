import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
const appVersion = pkg.version
const buildId = (process.env.GITHUB_SHA || process.env.VITE_BUILD_ID || 'local').slice(0, 7)
const buildDate = process.env.BUILD_DATE || new Date().toISOString()

function createVersionManifest() {
  return JSON.stringify(
    {
      appName: 'InsulinCalc',
      version: appVersion,
      buildId,
      buildDate,
      notes: [
        'Version visible dans l’application et dans le build.',
        'Détection explicite des nouvelles versions disponibles.',
        'Mise à jour forcée depuis le diagnostic sans purge manuelle du navigateur.',
      ],
    },
    null,
    2,
  )
}

function createWebManifest() {
  return JSON.stringify(
    {
      name: 'InsulinCalc',
      short_name: 'InsulinCalc',
      description: 'Calculateur d’insuline et suivi glycémique',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#14b8a6',
      icons: [
        { src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: './icons.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    null,
    2,
  )
}

function createServiceWorkerSource() {
  return `
const CACHE_PREFIX = 'insulincalc-app-';
const CACHE_NAME = \`\${CACHE_PREFIX}${buildId}\`;
const CORE_ASSETS = ['./', './index.html', './manifest.webmanifest', './version.json', './favicon.svg'];

async function cleanupOldCaches() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name))
  );
}

function isAppShellRequest(request) {
  const url = new URL(request.url);
  return request.mode === 'navigate'
    || url.pathname.endsWith('/index.html')
    || url.pathname.endsWith('/manifest.webmanifest')
    || url.pathname.endsWith('/version.json');
}

function isStaticAssetRequest(request) {
  if (request.method !== 'GET') return false;
  if (!request.url.startsWith(self.location.origin)) return false;
  return ['script', 'style', 'font', 'image'].includes(request.destination);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cache.match(request) || caches.match('./index.html');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await cleanupOldCaches();
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_OLD_CACHES') {
    event.waitUntil(cleanupOldCaches());
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (isAppShellRequest(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (isStaticAssetRequest(event.request)) {
    event.respondWith(cacheFirst(event.request));
  }
});
`.trimStart()
}

function versionArtifactsPlugin() {
  return {
    name: 'insulincalc-version-artifacts',
    apply: 'build',
    transformIndexHtml(html) {
      return html
        .replace(
          '<meta name="version" content="6.0.0" />',
          `<meta name="version" content="${appVersion}" />`,
        )
        .replace(
          '</head>',
          `    <link rel="manifest" href="./manifest.webmanifest?v=${buildId}" />\n  </head>`,
        )
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: createVersionManifest(),
      })
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: createWebManifest(),
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: createServiceWorkerSource(),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionArtifactsPlugin()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  build: {
    outDir: 'build',
  },
})
