import { NextRequest, NextResponse } from "next/server";

interface PageText {
  page: number;
  text: string;
}

interface SubsectionResult {
  title: string;
  startPage: number;
  endPage: number;
  summary: string;
}

interface SectionResult {
  title: string;
  startPage: number;
  endPage: number;
  summary: string;
  subsections?: SubsectionResult[];
}

interface ChapterResult {
  title: string;
  startPage: number;
  endPage: number;
  summary: string;
  sections: SectionResult[];
}

function buildSystemPrompt(language: string): string {
  const lang = language === "en" ? "English" : "中文";
  const langRule = language === "en"
    ? `- All summaries must be written in **English**
- Chapter/section titles should keep the original language from the book (do NOT translate titles)
- If the book mixes languages in titles, keep the original language for each title as-is`
    : `- 所有 summary 必须使用**中文**书写
- 章节标题保留原书语言（不要翻译标题）
- 如果原书标题是中英混合，保持原样`;

  return `你是一个专业的书籍结构分析助手。你的任务是分析一批书页文本，识别其中的章节和小节结构。

## 核心原则：以目录页为权威参考
如果这批页面中包含目录页（Table of Contents / 目录），**必须以目录页为权威参考**来确定：
- 层级关系：哪些是「部/Part」、哪些是「章/Chapter」、哪些是「节/Section」
- 每个单元的准确页码
- 正确的嵌套关系

即使后续正文的标题格式不太一致，也要以目录页的层级为准。

## 层级结构——严格遵循原书
输出最多三个层级：chapter → section → subsection。**层级划分必须忠实反映原书的实际结构**：

- 如果书有「部 → 章 → 节」三层：部 = chapter，章 = section，节 = subsection
- 如果书有「章 → 节 → 小节」三层：章 = chapter，节 = section，小节 = subsection
- 如果书有「章 → 节」两层：章 = chapter，节 = section，subsections 省略
- 如果书只有「章」一层：sections 为空数组

**关键**：同一个 chapter 层级的条目必须是同一层级的结构单元。不要把「第一部分」和「第三章」放在同一层。

## 语言规则
${langRule}

## 标题一致性
- 标题保留原书的语言和格式（如原书写 "Chapter 3" 就保留，写「第三章」也保留）
- 不要自行翻译或改写标题
- 同一层级的标题风格应该一致
- All titles must have consistent capitalization (if English, use Title Case)
- Empty or blank titles are NOT allowed — if you can't determine a title, use a descriptive placeholder like "Untitled Section (p.XX)" where XX is the start page number
- Section/subsection titles that are just 1-2 generic words (e.g. "Introduction", "Summary") should include more context from the content to be distinguishable (e.g. "Introduction: The Rise of Machine Learning")

## 识别规则
- 章标题通常有明显标记：「第X章」「Chapter X」「Part X」或独占一页的大标题
- 节标题通常是加粗/编号的子标题：「1.1」「一、」或类似格式
- 如果看不出明确的章节划分，按内容主题的自然转换来分段
- 前言、序言作为独立 chapter 处理
- 目录页、版权页不需要作为 chapter 输出，跳过即可

## 续接规则
如果提供了 previousChapters，说明前面的批次已经识别了一些章节。最后一章可能还没结束：
- 如果这批页面的开头仍属于上一章，在返回结果中第一个 chapter 的 title 写 "CONTINUE"，表示它是上一章的延续
- 新发现的章节正常列出
- **绝对不要重复输出 previousChapters 中已经存在的章节**。只输出这批页面中新发现的章节或 CONTINUE
- 如果某个章节已经在 previousChapters 中出现，不要再次输出它

## 概括要求
- summary 不要复述章节标题，要概括实际内容
- 用一两句话说清楚这一章/节讲了什么、论证了什么、引入了什么概念
- summary 使用 ${lang} 书写
- 如果某些页是空白/图片/没有文字，在 summary 中注明

## 输出格式
严格 JSON 数组，每个元素是一个 chapter：
[
  {
    "title": "章标题（保留原书语言）",
    "startPage": 起始页码,
    "endPage": 结束页码,
    "summary": "${lang}概括",
    "sections": [
      {
        "title": "节标题",
        "startPage": 起始页码,
        "endPage": 结束页码,
        "summary": "${lang}概括",
        "subsections": [
          {
            "title": "小节标题",
            "startPage": 起始页码,
            "endPage": 结束页码,
            "summary": "${lang}概括"
          }
        ]
      }
    ]
  }
]

sections 和 subsections 数组可以为空或省略（如果没有对应的子层级）。`;
}

function buildOverviewPrompt(language: string): string {
  if (language === "en") {
    return `Based on the following book chapter structure, write a 3-5 sentence overview of the entire book. Do not list chapters — summarize the core themes, argument logic, and main contributions.\n\nChapter structure:\n`;
  }
  return `根据以下完整的书籍章节结构，用 3-5 句话写一个全书内容概述。不要列举章节，而是概括这本书的核心主题、论证逻辑和主要贡献。\n\n章节结构：\n`;
}

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

  const { bookTitle, pageTexts, previousChapters, batchIndex, totalBatches, model, generateOverview, language } =
    await request.json() as {
      bookTitle: string;
      pageTexts: PageText[];
      previousChapters?: ChapterResult[];
      batchIndex: number;
      totalBatches: number;
      model?: string;
      generateOverview?: boolean;
      language?: string;
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

  const lang = language === "en" ? "en" : "zh";
  const systemPrompt = buildSystemPrompt(lang);

  // Build the page content string
  const pagesContent = pageTexts
    .map((p) => `--- Page ${p.page} ---\n${p.text || "[no text content]"}`)
    .join("\n\n");

  let userPrompt = `Analyzing the structure of "${bookTitle}" (batch ${batchIndex + 1}/${totalBatches}).\n\n`;

  if (previousChapters && previousChapters.length > 0) {
    const prevSummary = previousChapters
      .map((c) => `- ${c.title} (p.${c.startPage}-${c.endPage})`)
      .join("\n");
    userPrompt += `Previously identified chapters:\n${prevSummary}\n\n`;
  }

  userPrompt += `Pages ${pageTexts[0].page} to ${pageTexts[pageTexts.length - 1].page}:\n\n${pagesContent}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
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
      const allChapters = [...(previousChapters || [])];

      for (const ch of chapters) {
        if (ch.title === "CONTINUE" && allChapters.length > 0) {
          const last = allChapters[allChapters.length - 1];
          last.endPage = ch.endPage;
          last.sections = [...(last.sections || []), ...(ch.sections || [])];
          if (ch.summary) last.summary += " " + ch.summary;
        } else {
          allChapters.push(ch);
        }
      }

      const chaptersListing = allChapters
        .map((c) => `${c.title} (p.${c.startPage}-${c.endPage}): ${c.summary}`)
        .join("\n");

      const overviewRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildOverviewPrompt(lang) + chaptersListing }] }],
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
