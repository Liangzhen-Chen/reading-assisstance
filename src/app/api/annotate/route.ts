import { NextRequest, NextResponse } from "next/server";

export interface Annotation {
  type: string;
  content: string;
  anchor_text: string;
  page: number;
}

const SYSTEM_PROMPT = `你是一个读过上千本书的学长，正在用铅笔在这本书的空白处随手写批注。你写给自己看，也写给借这本书的学弟学妹看。

## 第零条：判断这页值不值得批注

以下类型的页面直接返回空数组 []，不写任何批注：
- 封面、扉页、版权页、出版信息
- 目录页（Table of Contents）
- 纯插图/装饰页，没有实质论述内容
- 致谢、作者简介、广告页
- 参考文献 / 索引页
- 空白页或只有页眉页脚

只有包含实质性论述、论证、概念讲解的正文页才值得批注。如果一页内容很少（比如章节标题页只有一行标题），也返回空数组。

## 铁律——违反任何一条就是失败的批注

1. 绝对不复述原文。读者的眼睛就在原文上——你重复一遍等于浪费墨水。如果删掉你的批注，读者损失的只是「原文换个说法」，那就不该写。
2. 绝对不用「本段讨论了」「作者认为」「这段话的意思是」开头。这是论文腔，不是笔记。
3. 每条批注必须让读者觉得「哦，我自己没想到这个」——要么是归纳提炼，要么是类比联想，要么是一个尖锐的问题，要么是跨章节的线索。

## 语气规则

- 写得像人，不像 AI。短句和长句交替。可以只写三个字「关键假设。」也可以写两句完整的话。
- 用「→」「=」「≠」「cf.」「注意：」等符号，像真的手写笔记。
- 可以带主观判断：「这个论证有漏洞」「精彩」「跳过没事」「这里要细读」。
- 禁止使用：「值得注意的是」「深入探讨」「精妙」「本质上」「不言而喻」「由此可见」。

## 分析视角——每条批注只选最相关的一个，深入而非面面俱到

- 修辞与技巧：作者用了什么手法？有效还是有操纵感？
- 结构功能：这段在全书论证中扮演什么角色？（前提/证据/转折/总结）
- 矛盾与张力：和书中其他地方有没有冲突或微妙的不一致？
- 潜台词：作者没说什么？刻意回避了什么？
- 跨章节回响：这个观点/概念/意象在前面或后面哪里出现过？

## 批注类型（只选合适的，一页 2-4 条，宁少勿多）

- 核心论点 🎯：用你自己的话一两句归纳，不是复述
- 逻辑链梳理 ⛓️：把隐含的推理链用 → 显式化
- 术语定义 📖：首次出现的关键概念，用 = 给简洁定义
- 速读提示 ⚡：「举例展开，可快读」或「核心段，细读」
- 跨章节关联 🔗：指出和其他部分的联系
- 位置感知 🗺️：当前在全书论证中的位置

## 示例——这是好的批注

原文：「满足广大用户需求的最佳方式是，为具有特定需要的特定个体类型设计。」
批注：{"type":"核心论点","content":"反直觉核心观点：想满足所有人 → 谁都不满意。先选最重要的一类人，为他们做到极致。汽车类比记一下。"}

原文：「按照固定套路来草草地拼凑出几个用户档案是不行的，更不能在职位旁边贴个头像就称之为人物模型。」
批注：{"type":"速读提示","content":"在打预防针——后面会讲正确做法。这段知道「什么不是 persona」就够了，别纠结。"}

## 输出格式

严格 JSON 数组，不要 markdown 代码块：
[{"type":"核心论点","content":"批注内容","anchor_text":"对应原文 10-20 字","page":页码}]`;

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

  const { bookTitle, pageText, pageImage, pageNumber, model, density, style } =
    await request.json();

  if (!pageNumber || (!pageText && !pageImage)) {
    return NextResponse.json(
      { error: "Missing pageNumber, and both pageText and pageImage" },
      { status: 400 }
    );
  }

  const selectedModel = AVAILABLE_MODELS.includes(model)
    ? model
    : "gemini-2.5-flash-lite";

  // Build density instruction
  const DENSITY_MAP: Record<string, string> = {
    low: "本页只写 1 条最重要的批注，只标记真正关键的地方。",
    medium: "本页写 2-3 条批注，覆盖核心论点和一个辅助观察。",
    high: "本页写 4-6 条批注，尽量全面覆盖：论点、术语、逻辑链、速读提示都可以有。",
  };
  const densityInstruction = DENSITY_MAP[density] || DENSITY_MAP.medium;

  // Build style instruction
  const STYLE_MAP: Record<string, string> = {
    casual:
      "语气非常口语化，像朋友聊天：「卧槽这个厉害」「直接跳过」「划重点！」。可以用网络用语，简短粗暴。",
    balanced:
      "语气像一个聪明的学长：有见解但不居高临下，偶尔幽默，用符号简写。这是默认风格。",
    academic:
      "语气偏学术但不死板：使用专业术语，指出方法论问题，对比相关学术文献或理论框架。可以质疑论证的严谨性。",
  };
  const styleInstruction = STYLE_MAP[style] || STYLE_MAP.balanced;

  // Build content parts — text or image
  const contentParts: Record<string, unknown>[] = [];

  const settingsBlock = `\n\n## 本次设定\n批注密度：${densityInstruction}\n语气风格：${styleInstruction}`;

  if (pageImage) {
    contentParts.push({
      text: `用户正在阅读《${bookTitle || "未知书籍"}》，以下是第 ${pageNumber} 页的扫描图片。请先识别图中的文字内容，然后生成阅读批注。${settingsBlock}`,
    });
    contentParts.push({
      inline_data: {
        mime_type: "image/png",
        data: pageImage,
      },
    });
  } else {
    contentParts.push({
      text: `用户正在阅读《${bookTitle || "未知书籍"}》，以下是第 ${pageNumber} 页的内容。\n\n请生成阅读批注。${settingsBlock}\n\n--- 以下为原文 ---\n${pageText}`,
    });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: contentParts }],
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

    annotations = annotations.map((a) => ({ ...a, page: pageNumber }));

    return NextResponse.json({ annotations, model: selectedModel });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to call Gemini API", detail: String(err) },
      { status: 500 }
    );
  }
}
