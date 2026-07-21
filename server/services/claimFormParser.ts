/**
 * Claim Form Parser Service
 * 解析 Director Claim Form PDF，提取每行的日期、金額、賣家資訊，
 * 然後從 BOXIUM 卡牌庫中 AI 智能匹配合理的卡牌/卡盒組合。
 */

import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
import { invokeLLM } from '../_core/llm';
import { getProductsByPriceRange } from '../db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClaimFormLine {
  date: string;          // e.g. "02/01/2026"
  boughtNoteNo: string;  // e.g. "BN202601010"
  seller: string;        // e.g. "轉賬交易 FPS/CHAN T**..."
  description: string;   // e.g. "Pokemon Shining Fates Elite Trainer Box x8"
  amount: number;        // HKD amount as number, e.g. 10000
}

export interface SuggestedItem {
  cardId: number;
  productType: 'single_card' | 'sealed_product';
  name: string;
  nameJa: string | null;
  imageUrl: string | null;
  series: string | null;
  setName: string | null;
  suggestedBuyPrice: number;   // The matched price from DB
  confidence: number;          // 0-1 confidence score
  reason: string;              // Why this was suggested
}

export interface ParsedClaimRow {
  lineIndex: number;
  date: string;
  boughtNoteNo: string;
  seller: string;
  description: string;
  totalAmount: number;
  suggestions: SuggestedItem[];
  // Selected suggestion (default = first / highest confidence)
  selected: SuggestedItem | null;
  // Override fields that user can edit
  overrideBuyPrice?: number;
  notes?: string;
}

// ─── Step 1: Extract text from PDF ───────────────────────────────────────────

export async function extractClaimFormLines(pdfBuffer: Buffer): Promise<ClaimFormLine[]> {
  const data = await pdfParse(pdfBuffer);
  const text = data.text;

  // Use LLM to extract structured rows from the raw PDF text
  const systemPrompt = `You are a financial document parser. Extract all transaction rows from this Director Claim Form PDF text.
Each row has: date (DD/MM/YYYY), bought note number (e.g. BN202601010), seller info, item description, and HKD amount.
Return a JSON array of objects with fields: date, boughtNoteNo, seller, description, amount (number, no currency symbol).
Only include rows that have a valid date and HKD amount. Skip header rows, totals, and empty lines.`;

  const userPrompt = `Parse this Claim Form text and extract all transaction rows:\n\n${text.slice(0, 8000)}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'claim_form_rows',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              rows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string', description: 'DD/MM/YYYY format' },
                    boughtNoteNo: { type: 'string', description: 'Bought note number e.g. BN202601010' },
                    seller: { type: 'string', description: 'Seller info / transfer description' },
                    description: { type: 'string', description: 'Item description' },
                    amount: { type: 'number', description: 'HKD amount as number' },
                  },
                  required: ['date', 'boughtNoteNo', 'seller', 'description', 'amount'],
                  additionalProperties: false,
                },
              },
            },
            required: ['rows'],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : null;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return (parsed.rows || []) as ClaimFormLine[];
  } catch (err) {
    console.error('[claimFormParser] LLM extraction failed:', err);
    return [];
  }
}

// ─── Step 2: AI-powered product matching ─────────────────────────────────────

/**
 * For each claim line, find the best matching product(s) from the BOXIUM card library
 * based on the total amount. The AI selects the most reasonable match.
 */
export async function matchProductsToClaimLines(
  lines: ClaimFormLine[]
): Promise<ParsedClaimRow[]> {
  const results: ParsedClaimRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Get candidates from DB (price within ±50% of target)
    const candidates = await getProductsByPriceRange(line.amount, 0.5, 20);

    if (candidates.length === 0) {
      // No candidates found — return empty suggestion
      results.push({
        lineIndex: i,
        date: line.date,
        boughtNoteNo: line.boughtNoteNo,
        seller: line.seller,
        description: line.description,
        totalAmount: line.amount,
        suggestions: [],
        selected: null,
        notes: '未找到符合價格範圍的卡牌/卡盒',
      });
      continue;
    }

    // Use LLM to rank candidates and pick the best match
    const candidateList = candidates.slice(0, 10).map((c, idx) => ({
      index: idx,
      name: c.name,
      nameJa: c.nameJa,
      series: c.series,
      setName: c.setName,
      productType: c.productType,
      avgPrice: c.avgPrice,
      priceCount: c.priceCount,
    }));

    const rankPrompt = `You are a Pokemon/TCG card trading expert. 
A company bought items for HKD ${line.amount}. The document says: "${line.description}".
From the following candidates (real market prices from BOXIUM database), pick the BEST match.
Consider: price closeness to HKD ${line.amount}, product type (sealed box vs single card), and description hints.
Return the index of the best match and a brief reason (in Traditional Chinese).

Candidates:
${JSON.stringify(candidateList, null, 2)}`;

    let bestIndex = 0;
    let bestReason = '價格最接近目標金額';

    try {
      const rankResponse = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are a TCG card market expert. Respond in JSON only.' },
          { role: 'user', content: rankPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'best_match',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                bestIndex: { type: 'number', description: 'Index of best candidate (0-based)' },
                reason: { type: 'string', description: 'Reason in Traditional Chinese' },
              },
              required: ['bestIndex', 'reason'],
              additionalProperties: false,
            },
          },
        },
      });

      const rawRankContent = rankResponse.choices?.[0]?.message?.content;
      const rankContent = typeof rawRankContent === 'string' ? rawRankContent : null;
      if (rankContent) {
        const ranked = JSON.parse(rankContent);
        bestIndex = Math.min(Math.max(0, ranked.bestIndex || 0), candidates.length - 1);
        bestReason = ranked.reason || bestReason;
      }
    } catch (err) {
      console.warn('[claimFormParser] LLM ranking failed, using price-closest:', err);
    }

    // Build suggestions list (best first)
    const suggestions: SuggestedItem[] = candidates.slice(0, 10).map((c, idx) => {
      const priceDiff = Math.abs(c.avgPrice - line.amount) / line.amount;
      const confidence = Math.max(0, 1 - priceDiff * 2); // 0% diff = 1.0, 50% diff = 0.0
      return {
        cardId: c.id,
        productType: c.productType,
        name: c.name,
        nameJa: c.nameJa,
        imageUrl: c.imageUrl,
        series: c.series,
        setName: c.setName,
        suggestedBuyPrice: Math.round(c.avgPrice),
        confidence: Math.round(confidence * 100) / 100,
        reason: idx === bestIndex ? bestReason : `市場均價 HK$${c.avgPrice.toFixed(0)}，接近目標金額`,
      };
    });

    // Reorder: put bestIndex first
    if (bestIndex > 0 && bestIndex < suggestions.length) {
      const [best] = suggestions.splice(bestIndex, 1);
      suggestions.unshift(best);
    }

    results.push({
      lineIndex: i,
      date: line.date,
      boughtNoteNo: line.boughtNoteNo,
      seller: line.seller,
      description: line.description,
      totalAmount: line.amount,
      suggestions,
      selected: suggestions[0] || null,
    });
  }

  return results;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function analyzeClaimFormPdf(pdfBuffer: Buffer): Promise<{
  rows: ParsedClaimRow[];
  totalLines: number;
  matchedLines: number;
  unmatchedLines: number;
}> {
  const lines = await extractClaimFormLines(pdfBuffer);
  const rows = await matchProductsToClaimLines(lines);

  const matchedLines = rows.filter(r => r.selected !== null).length;

  return {
    rows,
    totalLines: rows.length,
    matchedLines,
    unmatchedLines: rows.length - matchedLines,
  };
}
