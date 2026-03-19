const DB_NAME = "readlens";
const DB_VERSION = 1;
const BOOKS_STORE = "books";

export interface Book {
  id: string;
  title: string;
  fileName: string;
  data: ArrayBuffer;
  totalPages: number;
  lastPage: number;
  addedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
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
