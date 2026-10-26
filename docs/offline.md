# Offline use

A guide works without a network once the browser holds the files below, for example on a workshop tablet. The components fetch only these files and make no other request. A service worker that caches them, the page that holds the component and the guide data keeps every component working offline. Ticks need no network: they live in `localStorage`.

## Files

The page fetches a file when the component needs it: a BOM needs the stylesheet and `buildguide.js`, a board loads the other four on top. The sizes are generated from the files of this release.

<!-- generated: files -->

The URLs are the ones the page requests, built from the URL of `buildguide.js` (the other files sit next to it) and from the host:

| Host | Folder of the core files | Also fetched |
|---|---|---|
| [Plain HTML](core.md) | where you unpacked the archive, for example `assets/buildguide-<version>/` | the guide data (`data-src`), the page itself |
| [MkDocs](mkdocs.md) | `<site>/assets/buildguide/` | `buildguide-mkdocs.css` in the same folder, every page that holds a component (the data is inside it) |
| [Docusaurus](docusaurus.md) | `<baseUrl>assets/buildguide/` | every page that holds a component (the data is inside it) and the site's own bundles |

BOM images are fetched from the folder of `data-assets` (the `assets` option of the plugins) under the file name in each item's `image`. The license files shipped with the libraries are not fetched. To see the exact list for a page, open it and run this in the browser console:

```js
performance.getEntriesByType('resource').map((entry) => entry.name)
```

## A service worker

Save it as `sw.js` at the root of the site (a worker controls only the folder it is in) and replace the list with the URLs of your site: the core files, the guide data, the images of the BOM and each page that holds a component.

```js title="sw.js"
// change the name with every release of the site: the old cache is deleted when the new worker activates
const CACHE = 'buildguide-site-1';
const FILES = [
  '/assets/buildguide-<version>/buildguide.css',
  '/assets/buildguide-<version>/buildguide.js',
  '/assets/buildguide-<version>/buildguide-board.js',
  '/assets/buildguide-<version>/vendor/joint/joint.min.js',
  '/assets/buildguide-<version>/vendor/libavoid/index.js',
  '/assets/buildguide-<version>/vendor/libavoid/libavoid.wasm',
  '/guide.json',
  '/guide/',
];

self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))));
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('buildguide-site-') && name !== CACHE).map((name) => caches.delete(name)))),
));
self.addEventListener('fetch', (event) => event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request))));
```

Register it from a page:

```html
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script>
```

- `addAll` fails the install when one URL is missing, so a wrong path shows up at once and the old worker stays in place.
- The first visit installs the worker, the next page load is served from the cache. A worker needs HTTPS or `localhost` ([Service Worker API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)).
- It answers from the cache first, so a changed `guide.json` or page appears only after a new `CACHE` name. Serve those two network first if they change between releases.
- The tick storage is not part of the cache: clearing the site data of the browser removes both.
