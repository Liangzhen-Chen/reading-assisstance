const DB_NAME = "readlens";
const DB_VERSION = 3;
const BOOKS_STORE = "books";
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

export interface Book {
  id: string;
  title: string;
  fileName: string;
  data: ArrayBuffer;
  totalPages: number;
  lastPage: number;
  addedAt: number;
  structureStatus?: "pending" | "analyzing" | "ready" | "failed" | "skipped";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ANNOTATIONS_STORE)) {
        const store = db.createObjectStore(ANNOTATIONS_STORE, { keyPath: "id" });
        store.createIndex("bookId", "bookId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STRUCTURES_STORE)) {
        db.createObjectStore(STRUCTURES_STORE, { keyPath: "bookId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBook(book: Book): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    tx.objectStore(BOOKS_STORE).put(book);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, "readonly");
    const req = tx.objectStore(BOOKS_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllBooks(): Promise<Book[]> {
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
    const tx = db.transaction(BOOKS_STORE, "readwrite");
    tx.objectStore(BOOKS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateBookProgress(
  id: string,
  lastPage: number
): Promise<void> {
  const book = await getBook(id);
  if (book) {
    book.lastPage = lastPage;
    await saveBook(book);
  }
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
  const book = await getBook(id);
  if (book) {
    book.structureStatus = status;
    await saveBook(book);
  }
}
