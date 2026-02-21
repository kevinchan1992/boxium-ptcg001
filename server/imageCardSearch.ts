import { invokeLLM } from "./_core/llm";
import * as db from "./db";

/**
 * Search for a card by image using LLM image recognition
 * @param base64Image - Base64 encoded image data (with data:image prefix)
 * @returns Search result with card name and success status
 */
export async function searchCardByImage(base64Image: string): Promise<{
  success: boolean;
  cardName?: string;
  cardId?: number;
  confidence?: string;
  error?: string;
}> {
  try {
    console.log("[Image Card Search] Starting image recognition...");

    // Call LLM to identify the card
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a Pokémon Trading Card Game expert. Analyze the provided card image and identify the card name in English, Japanese, or Chinese. Return ONLY the card name without any additional explanation.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please identify this Pokémon card and provide its name in English, Japanese, or Chinese (whichever is visible on the card). Return ONLY the card name.",
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    const identifiedName = typeof content === 'string' ? content.trim() : null;

    if (!identifiedName) {
      console.error("[Image Card Search] No card name identified");
      return {
        success: false,
        error: "Failed to identify card from image",
      };
    }

    console.log(`[Image Card Search] Identified card name: ${identifiedName}`);

    // Search for the card in the database
    const searchResults = await db.searchCards(identifiedName, 5);

    if (searchResults.length === 0) {
      console.log("[Image Card Search] No matching cards found in database");
      return {
        success: true,
        cardName: identifiedName,
        confidence: "low",
      };
    }

    // Return the first (best) match
    const bestMatch = searchResults[0];
    console.log(`[Image Card Search] Found matching card: ${bestMatch.name} (ID: ${bestMatch.id})`);

    return {
      success: true,
      cardName: bestMatch.name,
      cardId: bestMatch.id,
      confidence: "high",
    };
  } catch (error: any) {
    console.error("[Image Card Search] Error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
    };
  }
}
