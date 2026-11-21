const MPS_VERSION = "688f547b56fa758b03ac4efd43f01ae5891e1907afd078f84fad6d62527c5417";
"use strict";
(() => {
  // demo-app/pwa/worker/worker-core.ts
  var FILES_CACHE = "mps-files";
  var META_CACHE = "mps-meta";
  var BATCH_FILES = 4;
  var BATCH_BYTES = 25 * 1024 * 1024;
  var PARALLEL_DOWNLOADS = 2;
  var CORE_PARALLEL_DOWNLOADS = 6;
  function createWorkerCore(options) {
    const { caches, version, scope, origin } = options;
    const appPath = `${scope}app/`;
    const neverCached = /* @__PURE__ */ new Set([`${scope}sw.js`, new URL(options.manifestUrl).pathname]);
    let manifest = null;
    let byPath = null;
    let lastErrors = [];
    const fileKey = (entry) => `${origin}${scope}__mps/${entry.sha256}`;
    const listKey = (forVersion) => `${origin}${scope}__mps/list/${forVersion}`;
    async function loadList() {
      if (manifest) {
        return manifest;
      }
      const stored = await (await caches.open(META_CACHE)).match(listKey(version));
      if (!stored) {
        return null;
      }
      useList(await stored.json());
      return manifest;
    }
    function useList(list) {
      manifest = list;
      byPath = new Map([...list.core, ...list.heavy].map((entry) => [entry.url, entry]));
    }
    async function download(entry, files) {
      const response = await options.fetch(`${origin}${entry.url}`, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const content = await response.arrayBuffer();
      const hash = await options.digest(content);
      if (hash !== entry.sha256) {
        throw new Error("content does not match its hash (a deployment may be in progress)");
      }
      const type = response.headers.get("content-type") ?? "application/octet-stream";
      await files.put(fileKey(entry), new Response(content, { headers: { "content-type": type, "content-length": String(content.byteLength) } }));
    }
    async function missing(entries, files) {
      const present = await Promise.all(entries.map(async (entry) => !!await files.match(fileKey(entry))));
      return entries.filter((_, index) => !present[index]);
    }
    async function pool(items, width, task) {
      const failures = [];
      let next = 0;
      const lane = async () => {
        while (next < items.length) {
          const item = items[next++];
          try {
            await task(item);
          } catch (error) {
            failures.push({ item, error });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(width, items.length) }, lane));
      return failures;
    }
    async function install() {
      const response = await options.fetch(`${options.manifestUrl}?v=${version}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`precache list: HTTP ${response.status}`);
      }
      const list = await response.json();
      if (list.version !== version) {
        throw new Error(`precache list is version ${list.version}, this worker is version ${version}`);
      }
      const files = await caches.open(FILES_CACHE);
      const failures = await pool(await missing(list.core, files), CORE_PARALLEL_DOWNLOADS, (entry) => download(entry, files));
      if (failures.length) {
        throw new Error(`install failed: ${failures.map((failure) => `${failure.item.url} (${describe(failure.error)})`).join(", ")}`);
      }
      await (await caches.open(META_CACHE)).put(listKey(version), new Response(JSON.stringify(list), { headers: { "content-type": "application/json" } }));
      useList(list);
    }
    async function activate() {
      const list = await loadList();
      if (!list) {
        return;
      }
      const keep = new Set([...list.core, ...list.heavy].map((entry) => fileKey(entry)));
      const files = await caches.open(FILES_CACHE);
      for (const key of await files.keys()) {
        if (!keep.has(key.url)) {
          await files.delete(key);
        }
      }
      const meta = await caches.open(META_CACHE);
      for (const key of await meta.keys()) {
        if (key.url !== listKey(version)) {
          await meta.delete(key);
        }
      }
    }
    async function status() {
      const list = await loadList();
      if (!list) {
        return { state: "not-installed", version, done: 0, total: 0, bytes: 0, totalBytes: 0, errors: [] };
      }
      const absent = await missing(list.heavy, await caches.open(FILES_CACHE));
      const absentBytes = absent.reduce((sum, entry) => sum + entry.bytes, 0);
      const totalBytes = list.heavy.reduce((sum, entry) => sum + entry.bytes, 0);
      const state = absent.length === 0 ? "complete" : lastErrors.length ? "failed" : "preparing";
      return { state, version, done: list.heavy.length - absent.length, total: list.heavy.length, bytes: totalBytes - absentBytes, totalBytes, errors: state === "failed" ? lastErrors : [] };
    }
    async function preloadBatch() {
      const list = await loadList();
      if (!list) {
        return status();
      }
      const files = await caches.open(FILES_CACHE);
      const batch = [];
      let batchBytes = 0;
      for (const entry of await missing(list.heavy, files)) {
        if (batch.length === BATCH_FILES || batch.length > 0 && batchBytes + entry.bytes > BATCH_BYTES) {
          break;
        }
        batch.push(entry);
        batchBytes += entry.bytes;
      }
      const failures = await pool(batch, PARALLEL_DOWNLOADS, (entry) => download(entry, files));
      lastErrors = failures.map((failure) => ({ url: failure.item.url, reason: describe(failure.error) }));
      return status();
    }
    function respond(request) {
      if (request.method !== "GET") {
        return null;
      }
      const url = new URL(request.url);
      if (url.origin !== origin || !url.pathname.startsWith(scope) || neverCached.has(url.pathname)) {
        return null;
      }
      const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
      const navigation = request.mode === "navigate";
      if (byPath && !byPath.has(path) && !(navigation && path.startsWith(appPath))) {
        return null;
      }
      return serve(request, path, navigation);
    }
    async function serve(request, path, navigation) {
      await loadList();
      let entry = byPath?.get(path);
      if (!entry && navigation && path.startsWith(appPath)) {
        entry = byPath?.get(`${appPath}index.html`);
      }
      const cached = entry ? await (await caches.open(FILES_CACHE)).match(fileKey(entry)) : void 0;
      if (!cached) {
        return options.fetch(request);
      }
      const range = request.headers.get("range");
      return range ? slice(cached, range) : cached;
    }
    return { install, activate, preloadBatch, status, respond };
  }
  async function slice(response, range) {
    const content = await response.arrayBuffer();
    const size = content.byteLength;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = match && match[1] !== "" ? Number(match[1]) : NaN;
    let end = match && match[2] !== "" ? Number(match[2]) : size - 1;
    if (match && match[1] === "" && match[2] !== "") {
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    }
    if (!match || Number.isNaN(start) || start >= size || end < start) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    end = Math.min(end, size - 1);
    return new Response(content.slice(start, end + 1), {
      status: 206,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/octet-stream",
        "content-range": `bytes ${start}-${end}/${size}`,
        "content-length": String(end - start + 1),
        "accept-ranges": "bytes"
      }
    });
  }
  function describe(error) {
    if (error instanceof Error) {
      return error.name && error.name !== "Error" ? `${error.name}: ${error.message}` : error.message;
    }
    return String(error);
  }

  // demo-app/pwa/worker/sw.ts
  var scopeUrl = new URL(self.registration.scope);
  var core = createWorkerCore({
    caches: self.caches,
    fetch: (input, init) => self.fetch(input, init),
    digest: async (content) => [...new Uint8Array(await self.crypto.subtle.digest("SHA-256", content))].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    version: MPS_VERSION,
    manifestUrl: new URL("app/precache-manifest.json", scopeUrl).href,
    scope: scopeUrl.pathname,
    origin: scopeUrl.origin
  });
  self.addEventListener("install", (event) => {
    event.waitUntil(core.install());
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(core.activate().then(() => self.clients.claim()));
  });
  self.addEventListener("fetch", (event) => {
    const response = core.respond(event.request);
    if (response) {
      event.respondWith(response);
    }
  });
  self.addEventListener("message", (event) => {
    const message = event.data;
    const reply = (status) => {
      const port = event.ports[0];
      if (port) {
        port.postMessage(status);
      } else {
        event.source?.postMessage(status);
      }
    };
    if (message?.type === "skipWaiting") {
      event.waitUntil(self.skipWaiting().then(() => reply({ state: "activating" })));
    } else if (message?.type === "preloadBatch") {
      event.waitUntil(core.preloadBatch().then(reply));
    } else if (message?.type === "status") {
      event.waitUntil(core.status().then(reply));
    }
  });
})();
