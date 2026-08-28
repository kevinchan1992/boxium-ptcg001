/**
 * Rebuild the homepage trending-card cache through the existing protected
 * application endpoint. This runner is intentionally dependency-free so it
 * can run in a lightweight GitHub Actions job after data ingestion.
 */

const platformUrl = process.env.PLATFORM_URL?.replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET;

if (!platformUrl || !cronSecret) {
  throw new Error("PLATFORM_URL and CRON_SECRET must be configured as GitHub Actions secrets.");
}

const endpoint = `${platformUrl}/api/scheduled/calculateTrending`;
const maxAttempts = 3;

async function requestRecalculation() {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(90_000),
      });

      if (response.ok) {
        console.log(`[TrendingRecalc] Cache rebuilt successfully (HTTP ${response.status}, attempt ${attempt}).`);
        return;
      }

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      lastError = new Error(`Trending cache rebuild returned HTTP ${response.status}.`);
      if (!retryable || attempt === maxAttempts) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) break;
    }

    const delayMs = attempt * 2_000;
    console.warn(`[TrendingRecalc] Attempt ${attempt} failed; retrying in ${delayMs / 1000}s.`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw lastError ?? new Error("Trending cache rebuild failed without an error response.");
}

requestRecalculation().catch((error) => {
  console.error(`[TrendingRecalc] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
