/**
 * 简单的 IndexedDB 封装工具
 * 支持 custom-fonts 和 backgrounds 两个对象仓库
 */

const DB_NAME = "immersive-clock-db";
const DB_VERSION = 2;
const FONTS_STORE = "custom-fonts";
const BACKGROUNDS_STORE = "backgrounds";

interface IDBWrapper {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  getAll<T>(): Promise<T[]>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * 打开 IndexedDB 数据库
 * 在升级时自动创建所需的对象仓库
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FONTS_STORE)) {
        db.createObjectStore(FONTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BACKGROUNDS_STORE)) {
        db.createObjectStore(BACKGROUNDS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

/**
 * 为指定对象仓库创建 CRUD 包装器
 */
function createStoreWrapper(storeName: string): IDBWrapper {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async set<T>(key: string, value: T): Promise<void> {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async getAll<T>(): Promise<T[]> {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async del(key: string): Promise<void> {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async clear(): Promise<void> {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
  };
}

/** 自定义字体存储操作 */
export const db: IDBWrapper = createStoreWrapper(FONTS_STORE);

/** 背景图片存储操作 */
export const bgDb: IDBWrapper = createStoreWrapper(BACKGROUNDS_STORE);
