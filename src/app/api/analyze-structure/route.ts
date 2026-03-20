import { NextRequest, NextResponse } from "next/server";

interface PageText {
  page: number;
  text: string;
}

interface SectionResult {
  title: string;
  startPage: number;
  endPage: number;
  summary: string;
}

interface ChapterResult {
  title: string;
  startPage: number;
  endPage: number;
  summary: string;
  sections: SectionResult[];
}

const SYSTEM_PROMPT = `你是一个专业的书籍结构分析助手。你的任务是分析一批书页文本，识别其中的章节和小节结构。

## 任务
1. 识别这批页面中的**章**（chapter）和**节/小节**（section）边界
2. 为每个结构单元写一个 2-3 句话的内容概括
3. 标注每个单元的起止页码

## 识别规则
- 章标题通常有明显标记：「第X章」「Chapter X」「Part X」或独占一页的大标题
- 节标题通常是加粗/编号的子标题：「1.1」「一、」或类似格式
- 如果看不出明确的章节划分，按内容主题的自然转换来分段
- 目录页、版权页、序言等非正文内容也要标记，类型写在 title 里（如「目录」「前言」）

## 续接规则
如果提供了 previousChapters，说明前面的批次已经识别了一些章节。最后一章可能还没结束：
- 如果这批页面的开头仍属于上一章，在返回结果中第一个 chapter 的 title 写 "CONTINUE"，表示它是上一章的延续
- 新发现的章节正常列出

## 概括要求
- summary 不要复述章节标题，要概括实际内容
- 用一两句话说清楚这一章/节讲了什么、论证了什么、引入了什么概念
- 如果某些页是空白/图片/没有文字，在 summary 中注明

## 输出格式
严格 JSON 数组，每个元素是一个 chapter：
[
  {
    "title": "章标题",
    "startPage": 起始页码,
    "endPage": 结束页码,
    "summary": "2-3句概括",
    "sections": [
      {
        "title": "节标题",
        "startPage": 起始页码,
        "endPage": 结束页码,
        "summary": "2-3句概括"
      }
    ]
  }
]

sections 数组可以为空（如果这一章没有明显的小节划分）。`;

const OVERVIEW_PROMPT = `根据以下完整的书籍章节结构，用 3-5 句话写一个全书内容概述。不要列举章节，而是概括这本书的核心主题、论证逻辑和主要贡献。

章节结构：
`;

const AVAILABLE_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
];

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { bookTitle, pageTexts, previousChapters, batchIndex, totalBatches, model, generateOverview } =
    await request.json() as {
      bookTitle: string;
      pageTexts: PageText[];
      previousChapters?: ChapterResult[];
      batchIndex: number;
      totalBatches: number;
      model?: string;
      generateOverview?: boolean;
    };

  if (!pageTexts || pageTexts.length === 0) {
    return NextResponse.json(
      { error: "Missing pageTexts" },
      { status: 400 }
    );
  }

  const selectedModel = model && AVAILABLE_MODELS.includes(model)
    ? model
    : "gemini-2.5-flash-lite";

  // Build the page content string
  const pagesContent = pageTexts
    .map((p) => `--- 第 ${p.page} 页 ---\n${p.text || "[无文字内容]"}`)
    .join("\n\n");

  let userPrompt = `正在分析《${bookTitle}》的结构（批次 ${batchIndex + 1}/${totalBatches}）。\n\n`;

  if (previousChapters && previousChapters.length > 0) {
    const prevSummary = previousChapters
      .map((c) => `- ${c.title}（第${c.startPage}-${c.endPage}页）`)
      .join("\n");
    userPrompt += `前面批次已识别的章节：\n${prevSummary}\n\n`;
  }

  userPrompt += `以下是第 ${pageTexts[0].page} 页到第 ${pageTexts[pageTexts.length - 1].page} 页的内容：\n\n${pagesContent}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Gemini API error: ${res.status}`, detail: err },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    let chapters: ChapterResult[];
    try {
      chapters = JSON.parse(text);
    } catch {
      chapters = [];
    }

    // If this is the last batch and overview is requested, generate it
    let overview: string | undefined;
    if (generateOverview && chapters.length > 0) {
      // Merge with previous chapters for full picture
      const allChapters = [...(previousChapters || [])];

      // Merge CONTINUE chapter
      for (const ch of chapters) {
        if (ch.title === "CONTINUE" && allChapters.length > 0) {
          const last = allChapters[allChapters.length - 1];
          last.endPage = ch.endPage;
          last.sections = [...last.sections, ...ch.sections];
          if (ch.summary) last.summary += " " + ch.summary;
        } else {
          allChapters.push(ch);
        }
      }

      const chaptersListing = allChapters
        .map((c) => `${c.title}（第${c.startPage}-${c.endPage}页）: ${c.summary}`)
        .join("\n");

      const overviewRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: OVERVIEW_PROMPT + chaptersListing }] }],
            generationConfig: { temperature: 0.3 },
          }),
        }
      );

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        overview = overviewData.candidates?.[0]?.content?.parts?.[0]?.text || undefined;
      }
    }

    return NextResponse.json({ chapters, overview });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to call Gemini API", detail: String(err) },
      { status: 500 }
    );
  }
}
