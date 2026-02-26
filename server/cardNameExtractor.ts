/**
 * Card Name Extractor
 * 
 * Automatically extracts card names and numbers from text content
 * and searches for matching cards in the database.
 */

import * as db from './db';

/**
 * Extract card identifiers from text content
 * 
 * Patterns to match:
 * - Card numbers: XY-P 207, SM-P 288, etc.
 * - Card names: Pikachu, Charizard, Lillie, etc.
 * - Combined: Pikachu [XY-P 207]
 */
export async function extractCardsFromText(text: string, limit: number = 20): Promise<number[]> {
  const cardIds = new Set<number>();
  
  // Pattern 1: Extract card numbers (e.g., XY-P 207, SM-P 288)
  const cardNumberPattern = /([A-Z]{1,3}-[A-Z]{1,2}\s*\d{1,4})/gi;
  const cardNumbers = text.match(cardNumberPattern) || [];
  
  console.log('[CardNameExtractor] Found card numbers:', cardNumbers);
  
  for (const cardNumber of cardNumbers) {
    // Normalize card number (remove extra spaces)
    const normalizedNumber = cardNumber.replace(/\s+/g, ' ').trim();
    
    // Search for cards with this card number
    const cards = await db.searchCards(normalizedNumber, 5);
    
    for (const card of cards) {
      if (cardIds.size < limit) {
        cardIds.add(card.id);
        console.log(`[CardNameExtractor] Matched card by number: ${card.name} [${card.cardNumber}]`);
      }
    }
  }
  
  // Pattern 2: Extract card names (common Pokemon names)
  const commonCardNames = [
    'Pikachu', 'Charizard', 'Mewtwo', 'Mew', 'Eevee', 'Umbreon', 'Espeon',
    'Lillie', 'Marnie', 'Cynthia', 'Rosa', 'Acerola', 'Lusamine',
    'Rayquaza', 'Lugia', 'Ho-Oh', 'Giratina', 'Dialga', 'Palkia',
    '皮卡丘', '噴火龍', '超夢', '夢幻', '伊布', '月亮伊布', '太陽伊布',
    '莉莉艾', '瑪俐', '希羅娜', '露莎米奈',
  ];
  
  for (const cardName of commonCardNames) {
    // Case-insensitive search
    const regex = new RegExp(cardName, 'gi');
    if (regex.test(text)) {
      console.log(`[CardNameExtractor] Found card name in text: ${cardName}`);
      
      // Search for cards with this name
      const cards = await db.searchCards(cardName, 5);
      
      for (const card of cards) {
        if (cardIds.size < limit) {
          cardIds.add(card.id);
          console.log(`[CardNameExtractor] Matched card by name: ${card.name} [${card.cardNumber}]`);
        }
      }
    }
  }
  
  // Pattern 3: Extract specific phrases that indicate card analysis
  // e.g., "分析皮卡丘特典卡", "Pikachu PROMO cards"
  const analysisPatterns = [
    /分析\s*([^\s，。]+)\s*卡/g,
    /([^\s，。]+)\s*市場/g,
    /([^\s，。]+)\s*走勢/g,
  ];
  
  for (const pattern of analysisPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const keyword = match[1];
      if (keyword && keyword.length > 1) {
        console.log(`[CardNameExtractor] Found analysis keyword: ${keyword}`);
        
        // Search for cards with this keyword
        const cards = await db.searchCards(keyword, 5);
        
        for (const card of cards) {
          if (cardIds.size < limit) {
            cardIds.add(card.id);
            console.log(`[CardNameExtractor] Matched card by keyword: ${card.name} [${card.cardNumber}]`);
          }
        }
      }
    }
  }
  
  const result = Array.from(cardIds);
  console.log(`[CardNameExtractor] Total cards extracted: ${result.length}`);
  
  return result;
}

/**
 * Extract card data from text content and format for AI prompt
 * 
 * This function:
 * 1. Extracts card identifiers from text
 * 2. Queries database for card details and prices
 * 3. Formats card data for AI prompt
 */
export async function extractAndFormatCardData(text: string, limit: number = 20): Promise<string> {
  const cardIds = await extractCardsFromText(text, limit);
  
  if (cardIds.length === 0) {
    return '';
  }
  
  let formattedData = '\n【系統自動識別的卡牌資料】\n';
  formattedData += `系統從您的文字內容中識別到 ${cardIds.length} 張卡牌，以下是這些卡牌的詳細資料：\n\n`;
  
  for (const cardId of cardIds) {
    const card = await db.getCardById(cardId);
    if (!card) continue;
    
    // Get latest SNKRDUNK PSA10 price
    const latestPrices = await db.getPriceHistory(cardId, 'snkrdunk', 'PSA10', 1, undefined);
    const latestPrice = latestPrices.length > 0 ? latestPrices[0].price : null;
    const priceDate = latestPrices.length > 0 ? latestPrices[0].soldAt : null;
    
    formattedData += `卡牌：${card.name}${card.nameJa ? ` (${card.nameJa})` : ''} [${card.cardNumber}]\n`;
    if (latestPrice) {
      formattedData += `- 最新價格：HKD ${parseFloat(latestPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}（SNKRDUNK PSA10）\n`;
      if (priceDate) {
        formattedData += `- 價格日期：${new Date(priceDate).toISOString().split('T')[0]}\n`;
      }
    } else {
      formattedData += `- 最新價格：暫無價格資料\n`;
    }
    if (card.imageUrl) {
      formattedData += `- 圖片：${card.imageUrl}\n`;
    }
    formattedData += `\n`;
  }
  
  return formattedData;
}
