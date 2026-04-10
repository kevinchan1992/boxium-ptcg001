/**
 * Test: Gemini API direct connection
 * Verifies that GEMINI_API_KEY is valid and the API responds correctly.
 */
import { describe, it, expect } from "vitest";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

describe("Gemini API Connection", () => {
  it("should have GEMINI_API_KEY set", () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY must be set").toBeTruthy();
    expect(key!.length, "GEMINI_API_KEY must be non-empty").toBeGreaterThan(0);
  });

  it("should successfully call Gemini API and return a response", async () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const payload = {
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: "Reply with exactly: OK",
        },
      ],
      max_tokens: 16,
    };

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    expect(response.ok, `Gemini API returned ${response.status}: ${await response.text()}`).toBe(true);

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    expect(data.choices[0].message.content).toBeTruthy();

    console.log("✅ Gemini API response:", data.choices[0].message.content);
  }, 30000); // 30s timeout for API call
});
