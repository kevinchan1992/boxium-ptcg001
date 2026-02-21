import { invokeLLM } from "../_core/llm";
import { createGenerationRequest, updateGenerationStatus, getGenerationById } from "../db/articleGeneration";
import type { InsertArticleGenerationHistory } from "../../drizzle/schema";

/**
 * Detect language from text content
 */
function detectLanguage(text: string): string {
  // Simple language detection based on character patterns
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF]/.test(text);
  const traditionalChineseChars = /[繁體簡體臺灣]/.test(text);
  
  if (hasJapanese) return "ja";
  if (hasChinese && traditionalChineseChars) return "zh-TW";
  if (hasChinese) return "zh-CN";
  return "en";
}

/**
 * Fetch content from URL using Firecrawl MCP
 */
async function fetchUrlContent(url: string): Promise<{ content: string; title: string }> {
  try {
    // Use manus-mcp-cli to call Firecrawl scrape tool
    const { execSync } = require("child_process");
    
    const command = `manus-mcp-cli tool call scrape_url --server firecrawl --input '${JSON.stringify({
      url: url,
      formats: ["markdown", "html"]
    })}'`;
    
    const output = execSync(command, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    const result = JSON.parse(output);
    
    if (!result.success || !result.data) {
      throw new Error("Failed to fetch URL content");
    }
    
    return {
      content: result.data.markdown || result.data.html || "",
      title: result.data.metadata?.title || "Untitled"
    };
  } catch (error) {
    console.error("Error fetching URL content:", error);
    throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate article using AI
 */
async function generateArticleWithAI(params: {
  content: string;
  detectedLanguage: string;
  targetLanguage: string;
  style: string;
}): Promise<{
  title: string;
  content: string;
  excerpt: string;
  slug: string;
}> {
  const { content, detectedLanguage, targetLanguage, style } = params;
  
  // Prepare system prompt based on style and language
  const systemPrompt = `You are a professional Pokémon TCG content writer for BOXIUM platform. 
Your task is to analyze the provided content and create an original, engaging article in ${targetLanguage}.

Article Style: ${style}
Target Audience: Pokémon TCG collectors and investors
Platform Focus: Card pricing, market trends, investment insights

Requirements:
1. Write in ${targetLanguage} (${targetLanguage === "zh-TW" ? "Traditional Chinese" : targetLanguage === "ja" ? "Japanese" : "English"})
2. Create original content - DO NOT copy the source directly
3. Focus on insights relevant to BOXIUM users
4. Include market analysis and pricing perspectives
5. Use professional but accessible language
6. Format in Markdown with proper headings and structure
7. Length: 800-1500 words

Output Format (JSON):
{
  "title": "Article title in ${targetLanguage}",
  "content": "Full article content in Markdown format",
  "excerpt": "Brief summary (100-150 characters)",
  "slug": "url-friendly-slug"
}`;

  const userPrompt = `Source content (detected language: ${detectedLanguage}):

${content.substring(0, 5000)} ${content.length > 5000 ? "... (truncated)" : ""}

Please analyze this content and generate an original article for BOXIUM platform.`;

  try {
    const startTime = Date.now();
    
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "article_generation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Article title" },
              content: { type: "string", description: "Full article content in Markdown" },
              excerpt: { type: "string", description: "Brief summary" },
              slug: { type: "string", description: "URL-friendly slug" }
            },
            required: ["title", "content", "excerpt", "slug"],
            additionalProperties: false
          }
        }
      }
    });

    const processingTime = Date.now() - startTime;
    const resultContent = response.choices[0].message.content;
    
    if (!resultContent || typeof resultContent !== "string") {
      throw new Error("No content generated");
    }

    const result = JSON.parse(resultContent);
    
    return {
      title: result.title,
      content: result.content,
      excerpt: result.excerpt,
      slug: result.slug
    };
  } catch (error) {
    console.error("Error generating article with AI:", error);
    throw new Error(`AI generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Main function to generate article from URL or text
 */
export async function generateArticle(params: {
  userId: number;
  inputType: "url" | "text";
  inputContent: string;
  targetLanguage?: string;
  style?: string;
}): Promise<number> {
  const { userId, inputType, inputContent, targetLanguage, style = "analysis" } = params;
  
  const startTime = Date.now();
  
  // Create initial generation request
  const generationId = await createGenerationRequest({
    userId,
    inputType,
    inputContent,
    targetLanguage: targetLanguage || "zh-TW",
    style,
    status: "pending",
    detectedLanguage: null,
    generatedTitle: null,
    generatedContent: null,
    generatedExcerpt: null,
    generatedSlug: null,
    postId: null,
    errorMessage: null,
    processingTimeMs: null,
    tokensUsed: null
  });

  try {
    // Update status to processing
    await updateGenerationStatus(generationId, { status: "processing" });

    let sourceContent: string;
    let sourceTitle: string = "";

    // Fetch content based on input type
    if (inputType === "url") {
      const urlData = await fetchUrlContent(inputContent);
      sourceContent = urlData.content;
      sourceTitle = urlData.title;
    } else {
      sourceContent = inputContent;
    }

    // Detect language
    const detectedLanguage = detectLanguage(sourceContent);
    await updateGenerationStatus(generationId, { detectedLanguage });

    // Generate article using AI
    const generated = await generateArticleWithAI({
      content: sourceContent,
      detectedLanguage,
      targetLanguage: targetLanguage || "zh-TW",
      style
    });

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Update with generated results
    await updateGenerationStatus(generationId, {
      status: "completed",
      generatedTitle: generated.title,
      generatedContent: generated.content,
      generatedExcerpt: generated.excerpt,
      generatedSlug: generated.slug,
      processingTimeMs: processingTime
    });

    return generationId;
  } catch (error) {
    // Update with error
    await updateGenerationStatus(generationId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    });

    throw error;
  }
}

/**
 * Get generation result
 */
export async function getGenerationResult(generationId: number) {
  return await getGenerationById(generationId);
}
