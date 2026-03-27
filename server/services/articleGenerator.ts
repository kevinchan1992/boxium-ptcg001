import { invokeLLM } from "../_core/llm";
import { createGenerationRequest, updateGenerationStatus, getGenerationById } from "../db/articleGeneration";
import type { InsertArticleGenerationHistory } from "../../drizzle/schema_new";
import { getTemplate, applyTemplate } from "./articleTemplates";
import { analyzeSEO, generateMetaDescription } from "./seoAnalyzer";
import * as cheerio from "cheerio";

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
 * Fetch content from URL using native fetch + cheerio
 * Fallback solution when Firecrawl credits are insufficient
 */
async function fetchUrlContent(url: string): Promise<{ content: string; title: string }> {
  try {
    // Fetch HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract title
    const title = $('title').text() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text() || 
                  'Untitled';
    
    // Remove script, style, and other non-content elements
    $('script, style, nav, header, footer, iframe, noscript').remove();
    
    // Extract main content
    let content = '';
    
    // Try to find main content area
    const mainSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
      '.content'
    ];
    
    for (const selector of mainSelectors) {
      const mainContent = $(selector);
      if (mainContent.length > 0) {
        content = mainContent.text();
        break;
      }
    }
    
    // If no main content found, use body
    if (!content) {
      content = $('body').text();
    }
    
    // Clean up whitespace
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    if (!content) {
      throw new Error('No content extracted from URL');
    }
    
    return {
      content,
      title: title.trim()
    };
  } catch (error) {
    console.error('Error fetching URL content:', error);
    throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  // Get template based on style
  const templateMap: Record<string, string> = {
    "news": "news-brief",
    "analysis": "market-report",
    "review": "card-review"
  };
  const templateId = templateMap[style] || "news-brief";
  const template = getTemplate(templateId);
  
  const systemPrompt = `You are a professional TCG content writer for BOXIUM platform, covering Pokémon, One Piece and other trading card games. 
Your task is to analyze the provided content and create an original, engaging article in ${targetLanguage}.

Article Style: ${style}
Target Audience: TCG collectors and investors
Platform Focus: Card pricing, market trends, investment insights

${template ? `Template Structure:
${JSON.stringify(template.structure, null, 2)}

SEO Guidelines:
- Target keyword density: ${template.seoGuidelines.targetKeywordDensity}%
- Title length: ${template.seoGuidelines.titleLength.min}-${template.seoGuidelines.titleLength.max} characters
- Meta description length: ${template.seoGuidelines.metaDescLength.min}-${template.seoGuidelines.metaDescLength.max} characters
- Use heading structure: ${template.seoGuidelines.headingStructure.join(", ")}
` : ""}

Requirements:
1. Write in ${targetLanguage} (${targetLanguage === "zh-TW" ? "Traditional Chinese" : targetLanguage === "ja" ? "Japanese" : "English"})
2. Create original content - DO NOT copy the source directly
3. Focus on insights relevant to BOXIUM users
4. Include market analysis and pricing perspectives
5. Use professional but accessible language
6. Format in Markdown with proper headings and structure
7. **Length: 400-600 words** (concise and focused)
8. Follow the template structure and SEO guidelines above

**Writing Style Guidelines:**
- Use short, punchy paragraphs (2-3 sentences max)
- Lead with the most important information
- Use bullet points for lists and key points
- Include specific data and numbers when available
- Avoid flowery language - be direct and factual
- Use subheadings (##, ###) to break up content
- **DO NOT include image markdown syntax** - describe cards with text only
- Focus on market impact and investment insights

**Structure:**
- Opening: 1-2 sentences summarizing the main news
- Body: 2-3 short sections with specific details
- Closing: 1-2 sentences with market outlook or recommendation

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

    // Perform SEO analysis on generated content
    const seoAnalysis = analyzeSEO(
      generated.title,
      generated.content,
      generated.excerpt
    );

    // Generate optimized meta description if needed
    let metaDescription = generated.excerpt;
    if (metaDescription.length < 120 || metaDescription.length > 170) {
      metaDescription = generateMetaDescription(generated.content, 160);
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Update with generated results (including SEO data)
    await updateGenerationStatus(generationId, {
      status: "completed",
      generatedTitle: generated.title,
      generatedContent: generated.content,
      generatedExcerpt: metaDescription,
      generatedSlug: generated.slug,
      processingTimeMs: processingTime,
      // Store SEO analysis in metadata (if you want to persist it)
      // metadata: JSON.stringify({ seoScore: seoAnalysis.score, seoSuggestions: seoAnalysis.overallSuggestions })
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
