# ReadLens — Claude Code 开发指引

## 项目概述
ReadLens 是一个 AI 阅读批注 Web App。用户上传 PDF，在内置阅读器中阅读，AI 自动在段落旁生成轻量批注（核心论点、跨章节关联、逻辑链梳理等）。批注像一个聪明的学长在书页空白处写的铅笔笔记，不打断阅读，不替代阅读。

## 关键文档
- `docs/PRD.md` — 完整 PRD，包含产品定义、批注类型、MVP 范围、技术方案
- `docs/prototype.html` — 可交互的阅读器 UI 原型（浏览器打开查看），包含 Claude 和 Gemini 两套批注的对比效果

## 技术栈
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- pdf.js（PDF 渲染）
- Google Gemini 2.5 Flash Lite API（免费层，key 在 .env.local）
- IndexedDB（浏览器本地存储，存 PDF 文件和批注 JSON）
- 部署到 Vercel

## 当前状态
项目骨架已初始化（create-next-app），docs 文件夹里有 PRD 和原型。尚未开始功能开发。

## MVP 开发计划（按顺序执行）

### Phase 1 — 能读（先做这个）
1. 安装 pdf.js 依赖（pdfjs-dist）
2. 创建上传页面 `src/app/upload/page.tsx`：拖拽上传 PDF，存入 IndexedDB，跳转到阅读器
3. 创建阅读器页面 `src/app/reader/[bookId]/page.tsx`：从 IndexedDB 读取 PDF，用 pdf.js 渲染，支持翻页和目录导航
4. 创建首页/书架 `src/app/page.tsx`：显示已上传的书列表，点击进入阅读器
5. IndexedDB 工具函数 `src/lib/storage.ts`：封装书籍和批注的增删改查

### Phase 2 — 能批注
1. 创建 AI 批注 API `src/app/api/annotate/route.ts`：
   - 接收页面文本，调用 Gemini API 生成批注
   - Gemini API key 从环境变量 `GEMINI_API_KEY` 读取
   - 返回批注 JSON 数组
2. 创建 PDF 文本提取工具 `src/lib/pdfParser.ts`：从 PDF 按页提取文本
3. 批注 UI 组件 `src/components/AnnotationPanel.tsx`：侧边栏显示批注卡片，可折叠
4. 批注锚定：用 anchor_text 在 pdf.js text layer 中定位，高亮对应原文
5. 批注按页预生成：用户翻到新页时检查 IndexedDB 有无该页批注，没有则触发生成

### Phase 3 — 能用
1. Landing page
2. 书架页面完善（多本书管理、删除、阅读进度）
3. 批注密度/风格设置（用户可选择批注频次和语气风格，影响发给 Gemini 的 prompt）
4. 用量限制（每本书免费生成前 3 章批注）

## AI 批注 Prompt（已验证有效）

你是一个阅读批注助手，语气像一个聪明的、读过很多书的学长在书页空白处随手写的铅笔笔记。

用户正在阅读《{book_title}》，以下是第 {page_number} 页的内容。

请生成阅读批注。

关键要求——决定批注质量的核心规则：
- 绝对不要复述或改写原文。如果一条批注删掉后，读者损失的只是「原文换了个说法」，那这条批注就不该存在。
- 每条批注必须提供原文没有直接说出的东西：归纳提炼、类比联想、阅读策略建议、跨章节线索。
- 语气要像人写的笔记，简短有力，可以用「→」「=」等符号，可以带一点主观判断。

批注类型（只选合适的）：
- 核心论点：用自己的话归纳，不超过两句
- 逻辑链梳理：把隐含的推理链显式化，用 → 连接
- 术语定义：首次出现的关键概念，用 = 给出简洁定义
- 速读提示：告诉读者这段可以快读或需要细读
- 跨章节关联：指出和其他章节的联系
- 位置感知：当前在全书中的位置

输出严格 JSON 数组，不要 markdown 代码块：
[
  {
    "type": "核心论点",
    "content": "批注内容",
    "anchor_text": "对应原文片段（10-20字，用于定位）",
    "page": 页码数字
  }
]

--- 以下为原文 ---
{page_text}

## UI 设计参考
打开 `docs/prototype.html` 查看完整的阅读器布局：
- 左侧：PDF 原文阅读区（max-width 680px 居中）
- 右侧：固定 340px 宽批注侧边栏，按页分组显示批注卡片
- 顶部栏：logo、书名、批注开关
- 底部：翻页导航
- 批注卡片左侧有彩色边框标识类型，hover 时联动高亮原文中的锚定文本
- 配色：暖白背景 #faf9f6，批注高亮 #f0e6d3，绿色强调 #5b7f6a

## 注意事项
- .env.local 已配好 Gemini API key，不要提交到 git
- PDF 文件不要提交到 git（已在 .gitignore 中排除）
- Gemini 2.5 Flash Lite 是免费模型，如果遇到 429 限流错误，等 1 分钟重试
- anchor_text 匹配不上时，批注降级到页面底部的列表显示（兜底逻辑）
