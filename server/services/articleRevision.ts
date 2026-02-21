import { invokeLLM } from "../_core/llm";

interface ReviseArticleInput {
  originalTitle: string;
  originalContent: string;
  originalExcerpt: string;
  revisionRequest: string;
  targetLanguage: string;
}

interface ReviseArticleResult {
  title: string;
  content: string;
  excerpt: string;
}

/**
 * Revise article based on user's revision request
 */
export async function reviseArticle(input: ReviseArticleInput): Promise<ReviseArticleResult> {
  const { originalTitle, originalContent, originalExcerpt, revisionRequest, targetLanguage } = input;

  const systemPrompt = `你是一位專業的 Pokémon TCG 文章編輯。
用戶會提供一篇原始文章和修改要求，你需要根據要求修改文章。

修改原則：
1. 保持文章的核心主題和重要資訊
2. 根據用戶要求調整長度、風格、重點
3. 確保修改後的文章更專業、更易讀
4. 保持 Markdown 格式

輸出格式：
- 標題：修改後的文章標題
- 摘要：修改後的文章摘要（100-150 字）
- 內容：修改後的文章內容（Markdown 格式）`;

  const userPrompt = `原始文章：
標題：${originalTitle}
摘要：${originalExcerpt}
內容：
${originalContent}

修改要求：
${revisionRequest}

請根據以上要求修改文章，並以以下格式輸出：

標題：[修改後的標題]

摘要：[修改後的摘要]

內容：
[修改後的內容]`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const messageContent = response.choices[0]?.message?.content;
    const generatedText = typeof messageContent === 'string' ? messageContent : "";

    // Parse the response
    const titleMatch = generatedText.match(/標題[：:]\s*(.+?)(?=\n|$)/);
    const excerptMatch = generatedText.match(/摘要[：:]\s*([\s\S]+?)(?=\n\n|內容)/);
    const contentMatch = generatedText.match(/內容[：:]\s*\n([\s\S]+)/);

    const title = titleMatch ? titleMatch[1].trim() : originalTitle;
    const excerpt = excerptMatch ? excerptMatch[1].trim().replace(/\n/g, " ").substring(0, 200) : originalExcerpt;
    const content = contentMatch ? contentMatch[1].trim() : generatedText;

    return {
      title,
      excerpt,
      content,
    };
  } catch (error) {
    console.error("Error revising article:", error);
    throw new Error(`Failed to revise article: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
