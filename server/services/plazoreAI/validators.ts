import { AIGenerationResult } from "./types.js";

/**
 * Counts the number of words in a piece of text.
 * Used only to gently check that the summary stays within a comfortable reading range.
 */
function wordCount(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Validates the raw response from the model.
 * Ensures the AI returned exactly the shape we expect —
 * calm, complete, and free of invented structure.
 * If anything is missing or malformed, the response is rejected.
 */
export function validateAIResponse(raw: string): AIGenerationResult {
  let parsed: any;

  try {
    // Gently remove markdown fences if the model wrapped the JSON
    const cleaned = String(raw)
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI response is not valid JSON");
  }

  const requiredStringFields = [
    "summary",
    "overview",
    "shippingSummary",
    "confidenceExplanation",
  ];

  for (const field of requiredStringFields) {
    if (typeof parsed[field] !== "string" || !parsed[field].trim()) {
      throw new Error(`Missing or invalid field: ${field}`);
    }
  }

  if (!Array.isArray(parsed.highlights) || parsed.highlights.length === 0) {
    throw new Error("highlights must be a non-empty array");
  }

  if (!Array.isArray(parsed.bestFor) || parsed.bestFor.length === 0) {
    throw new Error("bestFor must be a non-empty array");
  }

  if (!Array.isArray(parsed.thingsToConsider)) {
    throw new Error("thingsToConsider must be an array");
  }

  const summary = parsed.summary.trim();
  const words = wordCount(summary);

  // Soft band around the 60–100 word goal
  // (models rarely land on exact counts, so we allow a comfortable range)
  if (words < 25 || words > 180) {
    throw new Error(
      `summary length out of expected range (${words} words; expected ~25–180)`
    );
  }

  return {
    summary,
    overview: parsed.overview.trim(),
    highlights: parsed.highlights.map((h: string) => String(h).trim()),
    bestFor: parsed.bestFor.map((b: string) => String(b).trim()),
    shippingSummary: parsed.shippingSummary.trim(),
    thingsToConsider: parsed.thingsToConsider.map((t: string) =>
      String(t).trim()
    ),
    confidenceExplanation: parsed.confidenceExplanation.trim(),
  };
}