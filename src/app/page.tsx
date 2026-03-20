"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllBooks, deleteBook, deleteBookStructure, deleteAllBookAnnotations, type BookMeta } from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAllBooks().then((b) => {
      setBooks(b.sort((a, c) => c.addedAt - a.addedAt));
      setLoaded(true);
    });
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定删除这本书？")) {
      await Promise.all([
        deleteBook(id),
        deleteBookStructure(id),
        deleteAllBookAnnotations(id),
      ]);
      setBooks((prev) => prev.filter((b) => b.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-[#e5e2db] flex items-center justify-between px-7">
        <div className="flex items-center gap-2 text-[#5b7f6a] font-bold text-lg">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          ReadLens
        </div>
        <a
          href="/upload"
          className="px-4 py-2 bg-[#5b7f6a] text-white text-sm font-medium rounded-lg hover:bg-[#4d6e5b] transition-colors"
        >
          上传 PDF
        </a>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-[#2c2c2c] mb-8">我的书架</h1>

        {!loaded ? (
          <p className="text-[#666]">加载中...</p>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-lg text-[#666] mb-4">书架空空如也</p>
            <a
              href="/upload"
              className="inline-block px-6 py-3 bg-[#5b7f6a] text-white font-medium rounded-lg hover:bg-[#4d6e5b] transition-colors"
            >
              上传你的第一本书
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <div
                key={book.id}
                onClick={() => router.push(`/reader/${book.id}`)}
                className="bg-white border border-[#e5e2db] rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">📄</div>
                  <button
                    onClick={(e) => handleDelete(book.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-[#999] hover:text-red-500 transition-all text-sm"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
                <h3 className="font-semibold text-[#2c2c2c] text-sm mb-1 line-clamp-2">
                  {book.title}
                </h3>
                <p className="text-xs text-[#999]">
                  {book.totalPages} 页 · 读到第 {book.lastPage} 页
                </p>
                <div className="mt-3 h-1 bg-[#f0efe9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5b7f6a] rounded-full transition-all"
                    style={{
                      width: `${(book.lastPage / book.totalPages) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
