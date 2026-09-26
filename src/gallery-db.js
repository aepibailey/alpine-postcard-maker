// The gallery lives in IndexedDB on the phone: one entry per poster, { id, recipe, thumbnail, updatedAt },
// and the owner's photos for photo posters, { id, blob } (a JPEG, at most 1600px on the long edge).
const DB_NAME = 'alpine-postcard-maker';
const STORE = 'posters';
const PHOTOS = 'photos';

let opening;
function db() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (event) => {
      if (event.oldVersion < 1) request.result.createObjectStore(STORE, { keyPath: 'id' });
      if (event.oldVersion < 2) request.result.createObjectStore(PHOTOS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

async function run(mode, work, storeName = STORE) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    const request = work(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listPosters() {
  const all = await run('readonly', (store) => store.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export const getPoster = (id) => run('readonly', (store) => store.get(id));

export async function putPoster(entry) {
  await run('readwrite', (store) => store.put(entry));
  return entry;
}

export const deletePoster = (id) => run('readwrite', (store) => store.delete(id));

export const getPhoto = (id) => run('readonly', (store) => store.get(id), PHOTOS);
export const putPhoto = (photo) => run('readwrite', (store) => store.put(photo), PHOTOS);
export const deletePhoto = (id) => run('readwrite', (store) => store.delete(id), PHOTOS);
export const listPhotoIds = () => run('readonly', (store) => store.getAllKeys(), PHOTOS);

// Ask Chrome to keep the gallery even when the phone runs low on space. Returns whether it will.
export async function keepStorage() {
  if (!navigator.storage?.persist) return false;
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}

export async function isStorageKept() {
  return navigator.storage?.persisted ? navigator.storage.persisted() : false;
}
