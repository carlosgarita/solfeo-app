/// <reference lib="webworker" />
// Service Worker de Solfeo.
// Estrategia: precache de todos los assets del build + fallback a index.html
// (SPA). Se registra desde `PwaPrompts.tsx` vía `virtual:pwa-register/react`.

import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

// `self.__WB_MANIFEST` lo inyecta vite-plugin-pwa en tiempo de build con la
// lista de assets a precachear (JS, CSS, HTML, íconos, manifest, etc.).
precacheAndRoute(self.__WB_MANIFEST);

// Limpia cachés de versiones anteriores.
cleanupOutdatedCaches();

// SPA fallback: cualquier navegación (URL directa, deep link) sirve
// `index.html` desde el precache y el router se encarga del resto.
const handler = createHandlerBoundToURL('index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//, /^\/sw\.js$/, /^\/manifest\.webmanifest$/],
});
registerRoute(navigationRoute);

// Actualización inmediata cuando el usuario acepta el prompt (`updateServiceWorker(true)`).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
