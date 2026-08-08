/* ============================================================
   HAFIZ — storage.js
   IndexedDB + LocalStorage wrapper untuk data offline
   ============================================================ */

const Storage = (() => {
  const DB_NAME = 'hafiz-db';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pages')) {
          db.createObjectStore('pages', { keyPath: 'page' }); // cached quran text per page
        }
        if (!db.objectStoreNames.contains('hafalan')) {
          db.createObjectStore('hafalan', { keyPath: 'pageNumber' }); // memorization records
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' }); // session history log
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' }); // metadata, surah list, misc
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode = 'readonly') {
    const db = await openDB();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function req2promise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function get(storeName, key) {
    const store = await tx(storeName);
    return req2promise(store.get(key));
  }

  async function getAll(storeName) {
    const store = await tx(storeName);
    return req2promise(store.getAll());
  }

  async function put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return req2promise(store.put(value));
  }

  async function del(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return req2promise(store.delete(key));
  }

  async function clearStore(storeName) {
    const store = await tx(storeName, 'readwrite');
    return req2promise(store.clear());
  }

  async function clearAll() {
    await clearStore('pages');
    await clearStore('hafalan');
    await clearStore('sessions');
    await clearStore('meta');
  }

  // ----- LocalStorage helpers (small/synchronous data: profile, settings) -----
  const LS_PREFIX = 'hafiz:';
  function lsGet(key, fallback = null) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch (e) {}
  }
  function lsRemoveAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }

  return {
    openDB, get, getAll, put, del, clearStore, clearAll,
    lsGet, lsSet, lsRemoveAll
  };
})();
