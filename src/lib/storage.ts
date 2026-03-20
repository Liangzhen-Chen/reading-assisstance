const DB_NAME = "readlens";
const DB_VERSION = 4;
const BOOKS_STORE = "books";
const BOOK_DATA_STORE = "bookData";
const ANNOTATIONS_STORE = "annotations";
const STRUCTURES_STORE = "structures";

export interface StoredAnnotation {
  type: string;
  content: string;
  anchor_text: string;
  page: number;
}

export interface PageAnnotations {
  id: string; // bookId:pageNum
  bookId: string;
  page: number;
  annotations: StoredAnnotation[];
  model: string;
  generatedAt: number;
}

export interface BookSubsection {
  title: string;
  startPage: number;
  endPage: number;
  summary: string;
}

export interface BookSection {
  title: string;
  startPage: number;
  endPage: number;
  summary: string;
  subsections?: BookSubsection[];
}

export interface BookChapter {
  title: string;
  startPage: number;
  endPage: number;
  summary: string;
  sections: BookSection[];
}

export interface BookStructure {
  bookId: string;
  analyzedAt: number;
  overview: string;
  language: string; // "zh" | "en"
  chapters: BookChapter[];
}

/** Lightweight metadata — no ArrayBuffer, safe to read/write frequently */
export interface BookMeta {
  id: string;
  title: string;
  fileName: string;
  totalPages: number;
  lastPage: number;
  addedAt: number;
  structureStatus?: "pending" | "analyzing" | "ready" | "failed" | "skipped";
}

/** Full book including PDF data — only read when opening the reader */
export interface Book extends BookMeta {
  data: ArrayBuffer;
}

// Singleton DB connection to avoid multiple open connections blocking upgrades
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function resetDB() {
  dbInstance = null;
  dbPromise = null;
}

function openDB(): Promise<IDBDatabase> {
  // Verify existing connection is still usable
  if (dbInstance) {
    try {
      // Quick health check — will throw if connection is closed
      dbInstance.transaction(BOOKS_STORE, "readonly");
      return Promise.resolve(dbInstance);
    } catch {
      resetDB();
    }
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      console.log("[Storage] DB upgrade: v" + oldVersion + " → v" + DB_VERSION, "stores:", Array.from(db.objectStoreNames));

      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BOOK_DATA_STORE)) {
        db.createObjectStore(BOOK_DATA_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ANNOTATIONS_STORE)) {
        const store = db.createObjectStore(ANNOTATIONS_STORE, { keyPath: "id" });
        store.createIndex("bookId", "bookId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STRUCTURES_STORE)) {
        db.createObjectStore(STRUCTURES_STORE, { keyPath: "bookId" });
      }

      // Migrate: if upgrading from v3, move data out of books store into bookData store
      if (oldVersion > 0 && oldVersion < 4 && db.objectStoreNames.contains(BOOKS_STORE)) {
        // Migration will happen in a post-open step since we can't easily
        // access old records during onupgradeneeded with the new schema.
        // We handle this gracefully in getBook / getBookData.
      }
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      console.log("[Storage] DB opened: v" + dbInstance.version, "stores:", Array.from(dbInstance.objectStoreNames));
      dbInstance.onclose = () => { console.log("[Storage] DB connection closed"); resetDB(); };
      dbInstance.onversionchange = () => {
        console.log("[Storage] DB version change detected, closing connection");
        dbInstance?.close();
        resetDB();
      };
      resolve(dbInstance);
    };
    request.onerror = () => {
      console.error("[Storage] DB open error:", request.error);
      resetDB();
      reject(request.error);
    };
    request.onblocked = () => {
      console.error("[Storage] DB upgrade blocked by another connection");
      resetDB();
      reject(new Error("IndexedDB upgrade blocked by another connection"));
    };
  });

  return dbPromise;
}

/**
 * Save a book: metadata goes to BOOKS_STORE, PDF data goes to BOOK_DATA_STORE.
 * This keeps the books store lightweight for frequent reads/writes.
 */
export async function saveBook(book: Book): Promise<void> {
  console.log("[Storage] saveBook:", book.id, "data size:", book.data.byteLength);
  const db = await openDB();
  const { data, ...meta } = book;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BOOKS_STORE, BOOK_DATA_STORE], "readwrite");
    tx.objectStore(BOOKS_STORE).put(meta);
    tx.objectStore(BOOK_DATA_STORE).put({ id: book.id, data });
    tx.oncomplete = () => { console.log("[Storage] saveBook complete"); resolve(); };
    tx.onerror = () => { console.error("[Storage] saveBook error:", tx.error); reject(tx.error); };
  });
}

/** Get book metadata only (lightweight, no ArrayBuffer) */
export async function getBookMeta(id: string): Promise<BookMeta | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, "readonly");
    const req = tx.objectStore(BOOKS_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get the PDF ArrayBuffer for a book (heavy, only call when opening reader) */
export async function getBookData(id: string): Promise<ArrayBuffer | undefined> {
  console.log("[Storage] getBookData:", id);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOK_DATA_STORE, "readonly");
    const req = tx.objectStore(BOOK_DATA_STORE).get(id);
    req.onsuccess = () => {
      const result = req.result;
      if (result) {
        console.log("[Storage] getBookData: found in bookData store,", result.data?.byteLength, "bytes");
        resolve(result.data);
      } else {
        console.log("[Storage] getBookData: not in bookData store, trying fallback to books store...");
        // Fallback: old schema might have data in books store
        const tx2 = db.transaction(BOOKS_STORE, "readonly");
        const req2 = tx2.objectStore(BOOKS_STORE).get(id);
        req2.onsuccess = () => {
          const fallback = req2.result?.data;
          console.log("[Storage] getBookData fallback:", fallback ? `${fallback.byteLength} bytes` : "NOT FOUND");
          resolve(fallback);
        };
        req2.onerror = () => { console.error("[Storage] getBookData fallback error"); resolve(undefined); };
      }
    };
    req.onerror = () => { console.error("[Storage] getBookData error:", req.error); reject(req.error); };
  });
}

/** Get full book (meta + data) — only use when you need the PDF data */
export async function getBook(id: string): Promise<Book | undefined> {
  const meta = await getBookMeta(id);
  if (!meta) return undefined;
  const data = await getBookData(id);
  if (!data) return undefined;
  return { ...meta, data };
}

/** Get all books metadata (for bookshelf display, no ArrayBuffer loaded) */
export async function getAllBooks(): Promise<BookMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, "readonly");
    const req = tx.objectStore(BOOKS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBook(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BOOKS_STORE, BOOK_DATA_STORE], "readwrite");
    tx.objectStore(BOOKS_STORE).delete(id);
    tx.objectStore(BOOK_DATA_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Update reading progress — only touches lightweight metadata store,
 * never reads the heavy ArrayBuffer.
 */
export async function updateBookProgress(
  id: string,
  lastPage: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    const store = tx.objectStore(BOOKS_STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const meta = req.result;
      if (meta) {
        meta.lastPage = lastPage;
        store.put(meta);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Annotations ---

function annotationKey(bookId: string, page: number): string {
  return `${bookId}:${page}`;
}

export async function savePageAnnotations(
  bookId: string,
  page: number,
  annotations: StoredAnnotation[],
  model: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANNOTATIONS_STORE, "readwrite");
    tx.objectStore(ANNOTATIONS_STORE).put({
      id: annotationKey(bookId, page),
      bookId,
      page,
      annotations,
      model,
      generatedAt: Date.now(),
    } satisfies PageAnnotations);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPageAnnotations(
  bookId: string,
  page: number
): Promise<PageAnnotations | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANNOTATIONS_STORE, "readonly");
    const req = tx.objectStore(ANNOTATIONS_STORE).get(annotationKey(bookId, page));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePageAnnotations(
  bookId: string,
  page: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANNOTATIONS_STORE, "readwrite");
    tx.objectStore(ANNOTATIONS_STORE).delete(annotationKey(bookId, page));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAllBookAnnotations(
  bookId: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ANNOTATIONS_STORE, "readwrite");
    const store = tx.objectStore(ANNOTATIONS_STORE);
    const index = store.index("bookId");
    const req = index.openCursor(IDBKeyRange.only(bookId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Book Structure ---

export async function saveBookStructure(
  structure: BookStructure
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STRUCTURES_STORE, "readwrite");
    tx.objectStore(STRUCTURES_STORE).put(structure);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBookStructure(
  bookId: string
): Promise<BookStructure | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STRUCTURES_STORE, "readonly");
    const req = tx.objectStore(STRUCTURES_STORE).get(bookId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBookStructure(
  bookId: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STRUCTURES_STORE, "readwrite");
    tx.objectStore(STRUCTURES_STORE).delete(bookId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateBookStructureStatus(
  id: string,
  status: Book["structureStatus"]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    const store = tx.objectStore(BOOKS_STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const book = req.result;
      if (book) {
        book.structureStatus = status;
        store.put(book);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
