# ReadLens — AI Reading Companion

> AI 赋能阅读，而非替代阅读。

ReadLens 是一个 Web 阅读器，用户上传 PDF 后，AI 自动在段落旁生成轻量批注——标记核心论点、串联前后章节、梳理逻辑链——不打断阅读，不替代阅读。

## Tech Stack

- **Framework:** Next.js (React + TypeScript)
- **PDF Rendering:** pdf.js
- **AI:** Google Gemini Flash (free tier)
- **Storage:** Browser IndexedDB
- **Deployment:** Vercel

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                  # Pages (file-system routing)
│   ├── page.tsx          # Home / Bookshelf
│   ├── upload/           # Upload page
│   ├── reader/[bookId]/  # Reader page
│   └── api/annotate/     # AI annotation API endpoint
├── components/           # Reusable UI components
└── lib/                  # Utilities (PDF parser, AI client, storage)
```

## Documentation

- [PRD](docs/PRD.md)
- [UI Prototype](docs/prototype.html) — open in browser to preview

## License

MIT
