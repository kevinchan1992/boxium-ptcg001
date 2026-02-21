/**
 * SEO Analyzer Service
 * Analyzes article content and provides SEO optimization suggestions
 */

export interface SEOAnalysisResult {
  score: number; // 0-100
  keywords: {
    primary: string[];
    density: Record<string, number>; // keyword -> density percentage
    suggestions: string[];
  };
  title: {
    length: number;
    score: number;
    suggestions: string[];
  };
  metaDescription: {
    length: number;
    score: number;
    suggestions: string[];
  };
  content: {
    wordCount: number;
    paragraphCount: number;
    headingStructure: { level: string; text: string }[];
    readabilityScore: number;
    suggestions: string[];
  };
  overallSuggestions: string[];
}

/**
 * Analyze article content for SEO
 */
export function analyzeSEO(
  title: string,
  content: string,
  metaDescription: string = ""
): SEOAnalysisResult {
  const keywords = analyzeKeywords(content);
  const titleAnalysis = analyzeTitle(title);
  const metaAnalysis = analyzeMetaDescription(metaDescription);
  const contentAnalysis = analyzeContent(content);
  
  // Calculate overall score
  const score = calculateOverallScore({
    keywords,
    title: titleAnalysis,
    meta: metaAnalysis,
    content: contentAnalysis
  });
  
  const overallSuggestions = generateOverallSuggestions({
    keywords,
    title: titleAnalysis,
    meta: metaAnalysis,
    content: contentAnalysis
  });
  
  return {
    score,
    keywords: {
      primary: keywords.primary,
      density: keywords.density,
      suggestions: keywords.suggestions
    },
    title: titleAnalysis,
    metaDescription: metaAnalysis,
    content: contentAnalysis,
    overallSuggestions
  };
}

/**
 * Analyze keywords and density
 */
function analyzeKeywords(content: string): {
  primary: string[];
  density: Record<string, number>;
  suggestions: string[];
} {
  // Remove markdown syntax and special characters
  const cleanContent = content
    .replace(/[#*`\[\]()]/g, '')
    .toLowerCase();
  
  const words = cleanContent.split(/\s+/).filter(w => w.length > 2);
  const totalWords = words.length;
  
  // Count word frequency
  const wordCount: Record<string, number> = {};
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1;
  }
  
  // Get top keywords (excluding common words)
  const commonWords = new Set(['的', '了', '是', '在', '和', '有', '我', '你', '他', '她', '它', '們', '這', '那', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
  
  const keywords = Object.entries(wordCount)
    .filter(([word]) => !commonWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  const primary = keywords.slice(0, 5).map(([word]) => word);
  
  // Calculate density
  const density: Record<string, number> = {};
  for (const [word, count] of keywords) {
    density[word] = (count / totalWords) * 100;
  }
  
  // Generate suggestions
  const suggestions: string[] = [];
  const topDensity = keywords[0] ? (keywords[0][1] / totalWords) * 100 : 0;
  
  if (topDensity < 1.5) {
    suggestions.push('主關鍵詞密度偏低（建議 2-3%），考慮增加關鍵詞出現次數');
  } else if (topDensity > 4) {
    suggestions.push('主關鍵詞密度過高（建議 2-3%），避免關鍵詞堆砌');
  }
  
  if (primary.length < 3) {
    suggestions.push('關鍵詞種類較少，建議增加相關長尾關鍵詞');
  }
  
  return { primary, density, suggestions };
}

/**
 * Analyze title
 */
function analyzeTitle(title: string): {
  length: number;
  score: number;
  suggestions: string[];
} {
  const length = title.length;
  const suggestions: string[] = [];
  let score = 100;
  
  // Check length (optimal: 50-60 chars)
  if (length < 40) {
    suggestions.push('標題過短（建議 50-60 字符），考慮添加更多描述性詞語');
    score -= 20;
  } else if (length > 70) {
    suggestions.push('標題過長（建議 50-60 字符），可能在搜索結果中被截斷');
    score -= 15;
  }
  
  // Check for numbers (increases CTR)
  if (!/\d/.test(title)) {
    suggestions.push('標題中加入數字可以提高點擊率（例如：「5 個技巧」）');
    score -= 10;
  }
  
  // Check for power words
  const powerWords = ['完全', '終極', '最佳', '必看', '獨家', '揭秘', '深度', '全面'];
  const hasPowerWord = powerWords.some(word => title.includes(word));
  if (!hasPowerWord) {
    suggestions.push('考慮使用吸引眼球的詞語（例如：「完全指南」、「深度分析」）');
    score -= 10;
  }
  
  return { length, score, suggestions };
}

/**
 * Analyze meta description
 */
function analyzeMetaDescription(metaDescription: string): {
  length: number;
  score: number;
  suggestions: string[];
} {
  const length = metaDescription.length;
  const suggestions: string[] = [];
  let score = 100;
  
  if (!metaDescription) {
    return {
      length: 0,
      score: 0,
      suggestions: ['缺少 meta 描述，這對 SEO 非常重要']
    };
  }
  
  // Check length (optimal: 150-160 chars)
  if (length < 120) {
    suggestions.push('Meta 描述過短（建議 150-160 字符），未充分利用展示空間');
    score -= 20;
  } else if (length > 170) {
    suggestions.push('Meta 描述過長（建議 150-160 字符），可能在搜索結果中被截斷');
    score -= 15;
  }
  
  // Check for call-to-action
  const ctaWords = ['了解', '查看', '發現', '探索', '閱讀', '立即'];
  const hasCTA = ctaWords.some(word => metaDescription.includes(word));
  if (!hasCTA) {
    suggestions.push('添加行動號召詞（例如：「立即了解」）可以提高點擊率');
    score -= 10;
  }
  
  return { length, score, suggestions };
}

/**
 * Analyze content structure
 */
function analyzeContent(content: string): {
  wordCount: number;
  paragraphCount: number;
  headingStructure: { level: string; text: string }[];
  readabilityScore: number;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  
  // Word count
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Paragraph count
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length;
  
  // Extract headings
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headingStructure: { level: string; text: string }[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    headingStructure.push({
      level: `H${match[1].length}`,
      text: match[2]
    });
  }
  
  // Calculate readability score (simplified)
  const avgWordsPerParagraph = wordCount / Math.max(paragraphCount, 1);
  let readabilityScore = 100;
  
  if (avgWordsPerParagraph > 100) {
    readabilityScore -= 20;
    suggestions.push('段落過長（平均 >100 詞），建議分成更短的段落提高可讀性');
  }
  
  // Check word count
  if (wordCount < 300) {
    suggestions.push('文章字數較少（<300 詞），建議增加內容深度以提升 SEO 效果');
    readabilityScore -= 30;
  } else if (wordCount > 2000) {
    suggestions.push('文章字數較多（>2000 詞），考慮添加目錄或分成系列文章');
  }
  
  // Check heading structure
  if (headingStructure.length === 0) {
    suggestions.push('缺少標題結構，添加 H2、H3 標題可以改善 SEO 和可讀性');
    readabilityScore -= 20;
  } else {
    const h1Count = headingStructure.filter(h => h.level === 'H1').length;
    if (h1Count > 1) {
      suggestions.push('有多個 H1 標題，建議只保留一個主標題');
      readabilityScore -= 10;
    }
  }
  
  return {
    wordCount,
    paragraphCount,
    headingStructure,
    readabilityScore,
    suggestions
  };
}

/**
 * Calculate overall SEO score
 */
function calculateOverallScore(analysis: {
  keywords: ReturnType<typeof analyzeKeywords>;
  title: ReturnType<typeof analyzeTitle>;
  meta: ReturnType<typeof analyzeMetaDescription>;
  content: ReturnType<typeof analyzeContent>;
}): number {
  const weights = {
    keywords: 0.25,
    title: 0.25,
    meta: 0.20,
    content: 0.30
  };
  
  const keywordScore = analysis.keywords.suggestions.length === 0 ? 100 : 70;
  
  return Math.round(
    keywordScore * weights.keywords +
    analysis.title.score * weights.title +
    analysis.meta.score * weights.meta +
    analysis.content.readabilityScore * weights.content
  );
}

/**
 * Generate overall suggestions
 */
function generateOverallSuggestions(analysis: {
  keywords: ReturnType<typeof analyzeKeywords>;
  title: ReturnType<typeof analyzeTitle>;
  meta: ReturnType<typeof analyzeMetaDescription>;
  content: ReturnType<typeof analyzeContent>;
}): string[] {
  const suggestions: string[] = [];
  
  // Priority suggestions based on score
  if (analysis.title.score < 70) {
    suggestions.push('🔴 優先優化標題，這對 SEO 影響最大');
  }
  
  if (analysis.meta.score < 70) {
    suggestions.push('🟡 優化 meta 描述可以提高搜索結果點擊率');
  }
  
  if (analysis.content.wordCount < 500) {
    suggestions.push('🟡 增加文章內容深度，建議至少 500 字');
  }
  
  if (analysis.keywords.primary.length < 3) {
    suggestions.push('🟢 增加相關關鍵詞，提升搜索覆蓋面');
  }
  
  return suggestions;
}

/**
 * Generate SEO-optimized meta description from content
 */
export function generateMetaDescription(content: string, maxLength: number = 160): string {
  // Extract first meaningful paragraph
  const paragraphs = content
    .replace(/^#{1,6}\s+.+$/gm, '') // Remove headings
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 50);
  
  if (paragraphs.length === 0) {
    return '';
  }
  
  let description = paragraphs[0];
  
  // Truncate to max length
  if (description.length > maxLength) {
    description = description.substring(0, maxLength - 3) + '...';
  }
  
  return description;
}
