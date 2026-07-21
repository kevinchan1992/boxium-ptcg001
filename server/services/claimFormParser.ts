/**
 * Claim Form Parser Service
 * 解析 Director Claim Form PDF，提取每行的日期、金額、賣家資訊，
 * 然後從 BOXIUM 卡牌庫中 AI 智能匹配合理的卡牌/卡盒組合（支援多件）。
 *
 * 核心邏輯：
 * 1. 用 LLM 解析 PDF 文字，提取結構化交易行
 * 2. 對每行總金額，從 DB 取出候選商品（按價格範圍）
 * 3. 用 LLM 生成「多件商品組合」方案，使總價盡量接近目標金額
 * 4. 返回最多 3 個替代組合供用戶覆核
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

/** A single item within a multi-item combination */
export interface SuggestedItem {
  cardId: number;
  productType: 'single_card' | 'sealed_product';
  name: string;
  nameJa: string | null;
  imageUrl: string | null;
  series: string | null;
  setName: string | null;
  suggestedBuyPrice: number;   // Price assigned to this item in the combination
  quantity: number;            // How many of this item (default 1)
}

/** A combination of one or more items that together match the target amount */
export interface ItemCombination {
  items: SuggestedItem[];
  totalPrice: number;          // Sum of all items' price × quantity
  deviation: number;           // Absolute deviation from target amount
  deviationPct: number;        // Deviation as % of target
  confidence: number;          // 0-1 overall confidence
  reason: string;              // Why this combination was suggested (Traditional Chinese)
}

export interface ParsedClaimRow {
  lineIndex: number;
  date: string;
  boughtNoteNo: string;
  seller: string;
  description: string;
  totalAmount: number;
  /** Up to 3 alternative combinations, sorted by confidence desc */
  combinations: ItemCombination[];
  /** Currently selected combination (default = first) */
  selectedCombination: ItemCombination | null;
  notes?: string;
}

// ─── Step 1: Extract text from PDF ───────────────────────────────────────────

export async function extractClaimFormLines(pdfBuffer: Buffer): Promise<ClaimFormLine[]> {
  const data = await pdfParse(pdfBuffer);
  const text = data.text;

  const systemPrompt = `You are a financial document parser. Extract all transaction rows from this Director Claim Form PDF text.
Each row has: date (DD/MM/YYYY), bought note number (e.g. BN202601010), seller info, item description, and HKD amount.
Return a JSON array of objects with fields: date, boughtNoteNo, seller, description, amount (number, no currency symbol).
Only include rows that have a valid date and HKD amount. Skip header rows, totals, and empty lines.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Parse this Claim Form text and extract all transaction rows:\n\n${text.slice(0, 8000)}` },
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
                    date: { type: 'string' },
                    boughtNoteNo: { type: 'string' },
                    seller: { type: 'string' },
                    description: { type: 'string' },
                    amount: { type: 'number' },
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

    const raw = response.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') return [];
    return (JSON.parse(raw).rows || []) as ClaimFormLine[];
  } catch (err) {
    console.error('[claimFormParser] LLM extraction failed:', err);
    return [];
  }
}

// ─── Step 2: Fetch candidates from DB ────────────────────────────────────────

type DbProduct = Awaited<ReturnType<typeof getProductsByPriceRange>>[0];

/**
 * For a given target amount, fetch candidates at multiple price tiers:
 * - Items priced near the full amount (single item)
 * - Items priced near 1/2 of the amount (2-item combos)
 * - Items priced near 1/3 of the amount (3-item combos)
 * - Items priced near 1/4 of the amount (4-item combos)
 * Deduplicate by cardId.
 */
async function fetchCandidatesForAmount(targetAmount: number): Promise<DbProduct[]> {
  const tiers = [
    { divisor: 1, tolerance: 0.5 },   // single item
    { divisor: 2, tolerance: 0.5 },   // 2-item combos
    { divisor: 3, tolerance: 0.5 },   // 3-item combos
    { divisor: 4, tolerance: 0.5 },   // 4-item combos
  ];

  const allResults: DbProduct[] = [];
  const seen = new Set<number>();

  for (const tier of tiers) {
    const tierTarget = targetAmount / tier.divisor;
    // Only query if tier target is at least HK$50 (avoid noise)
    if (tierTarget < 50) continue;
    const results = await getProductsByPriceRange(tierTarget, tier.tolerance, 15);
    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        allResults.push(r);
      }
    }
  }

  return allResults;
}

// ─── Step 3: AI-powered combination generation ───────────────────────────────

/**
 * Ask LLM to generate up to 3 item combinations from the candidates
 * that together total close to the target amount.
 */
async function generateCombinations(
  targetAmount: number,
  description: string,
  candidates: DbProduct[]
): Promise<ItemCombination[]> {
  if (candidates.length === 0) return [];

  const candidateList = candidates.slice(0, 30).map((c, idx) => ({
    index: idx,
    name: c.name,
    series: c.series || c.setName || '',
    productType: c.productType,
    avgPrice: Math.round(c.avgPrice),
    priceCount: c.priceCount,
  }));

  const systemPrompt = `You are a Pokemon/TCG card trading expert helping a company reconcile purchase records.
A company made a purchase for HKD ${targetAmount}. The document description is: "${description}".

Your task: From the candidate products below, generate up to 3 DIFFERENT combinations of items whose TOTAL PRICE is as close as possible to HKD ${targetAmount}.

Rules:
- Each combination can have 1 to 5 items (can repeat the same item with quantity > 1)
- Use the avgPrice as the price per unit
- Total = sum of (price × quantity) for all items in the combination
- Aim for total within ±20% of target HKD ${targetAmount}
- Prefer combinations where total is within ±10% of target
- Combinations should be realistic (e.g., a mix of sealed boxes and single cards is fine)
- Each combination must be DIFFERENT from the others
- Provide a brief reason in Traditional Chinese for each combination

Candidates (index, name, type, avgPrice):
${JSON.stringify(candidateList, null, 2)}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate up to 3 item combinations totaling close to HKD ${targetAmount}.` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'item_combinations',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              combinations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          candidateIndex: { type: 'number' },
                          quantity: { type: 'number' },
                          pricePerUnit: { type: 'number' },
                        },
                        required: ['candidateIndex', 'quantity', 'pricePerUnit'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['reason', 'items'],
                  additionalProperties: false,
                },
              },
            },
            required: ['combinations'],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') return [];

    const parsed = JSON.parse(raw) as {
      combinations: Array<{
        reason: string;
        items: Array<{ candidateIndex: number; quantity: number; pricePerUnit: number }>;
      }>;
    };

    const result: ItemCombination[] = [];

    for (const combo of (parsed.combinations || []).slice(0, 3)) {
      const items: SuggestedItem[] = [];
      let totalPrice = 0;

      for (const item of combo.items) {
        const idx = Math.min(Math.max(0, Math.round(item.candidateIndex)), candidates.length - 1);
        const c = candidates[idx];
        if (!c) continue;
        const qty = Math.max(1, Math.round(item.quantity || 1));
        const price = Math.round(item.pricePerUnit > 0 ? item.pricePerUnit : c.avgPrice);
        items.push({
          cardId: c.id,
          productType: c.productType,
          name: c.name,
          nameJa: c.nameJa,
          imageUrl: c.imageUrl,
          series: c.series,
          setName: c.setName,
          suggestedBuyPrice: price,
          quantity: qty,
        });
        totalPrice += price * qty;
      }

      if (items.length === 0) continue;

      const deviation = Math.abs(totalPrice - targetAmount);
      const deviationPct = deviation / targetAmount;
      // Confidence: 100% at 0% deviation, 0% at 30%+ deviation
      const confidence = Math.max(0, Math.round((1 - deviationPct / 0.3) * 100) / 100);

      result.push({
        items,
        totalPrice,
        deviation,
        deviationPct,
        confidence,
        reason: combo.reason || `總價 HK$${totalPrice.toLocaleString()}，接近目標 HK$${targetAmount.toLocaleString()}`,
      });
    }

    // Sort by confidence desc
    result.sort((a, b) => b.confidence - a.confidence);
    return result;
  } catch (err) {
    console.warn('[claimFormParser] LLM combination generation failed:', err);
    // Fallback: single best-price-match item
    const best = candidates.sort((a, b) => Math.abs(a.avgPrice - targetAmount) - Math.abs(b.avgPrice - targetAmount))[0];
    if (!best) return [];
    const deviation = Math.abs(best.avgPrice - targetAmount);
    const deviationPct = deviation / targetAmount;
    return [{
      items: [{
        cardId: best.id,
        productType: best.productType,
        name: best.name,
        nameJa: best.nameJa,
        imageUrl: best.imageUrl,
        series: best.series,
        setName: best.setName,
        suggestedBuyPrice: Math.round(best.avgPrice),
        quantity: 1,
      }],
      totalPrice: Math.round(best.avgPrice),
      deviation,
      deviationPct,
      confidence: Math.max(0, 1 - deviationPct / 0.3),
      reason: `市場均價 HK$${best.avgPrice.toFixed(0)}，最接近目標金額`,
    }];
  }
}

// ─── Step 4: Match all lines ──────────────────────────────────────────────────

export async function matchProductsToClaimLines(
  lines: ClaimFormLine[]
): Promise<ParsedClaimRow[]> {
  const results: ParsedClaimRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const candidates = await fetchCandidatesForAmount(line.amount);

    if (candidates.length === 0) {
      results.push({
        lineIndex: i,
        date: line.date,
        boughtNoteNo: line.boughtNoteNo,
        seller: line.seller,
        description: line.description,
        totalAmount: line.amount,
        combinations: [],
        selectedCombination: null,
        notes: '未找到符合價格範圍的卡牌/卡盒',
      });
      continue;
    }

    const combinations = await generateCombinations(line.amount, line.description, candidates);

    results.push({
      lineIndex: i,
      date: line.date,
      boughtNoteNo: line.boughtNoteNo,
      seller: line.seller,
      description: line.description,
      totalAmount: line.amount,
      combinations,
      selectedCombination: combinations[0] || null,
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
  const matchedLines = rows.filter(r => r.selectedCombination !== null).length;

  return {
    rows,
    totalLines: rows.length,
    matchedLines,
    unmatchedLines: rows.length - matchedLines,
  };
}
