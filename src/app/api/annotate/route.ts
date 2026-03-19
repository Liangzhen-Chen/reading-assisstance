import { NextRequest, NextResponse } from "next/server";

export interface Annotation {
  type: string;
  content: string;
  anchor_text: string;
  page: number;
}

const SYSTEM_PROMPT = `你是一个阅读批注助手，语气像一个聪明的、读过很多书的学长在书页空白处随手写的铅笔笔记。

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
]`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { bookTitle, pageText, pageNumber } = await request.json();

  if (!pageText || !pageNumber) {
    return NextResponse.json(
      { error: "Missing pageText or pageNumber" },
      { status: 400 }
    );
  }

  const userPrompt = `用户正在阅读《${bookTitle || "未知书籍"}》，以下是第 ${pageNumber} 页的内容。

请生成阅读批注。

--- 以下为原文 ---
${pageText}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.7,
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
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    let annotations: Annotation[];
    try {
      annotations = JSON.parse(text);
    } catch {
      annotations = [];
    }

    // Ensure page number is set correctly
    annotations = annotations.map((a) => ({ ...a, page: pageNumber }));

    return NextResponse.json({ annotations });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to call Gemini API", detail: String(err) },
      { status: 500 }
    );
  }
}
