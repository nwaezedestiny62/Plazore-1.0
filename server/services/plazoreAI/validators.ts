import { AIGenerationResult } from "./types.js";

/**
 * Counts the number of words in a piece of text.
 */
function wordCount(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Validates the raw response from the model.
 * Matches the short, friendly Plazore AI voice
 * (summary is 1–3 sentences, not a long essay).
 */
export function validateAIResponse(raw: string): AIGenerationResult {
  let parsed: any;

  try {
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
  const overview = parsed.overview.trim();
  const shippingSummary = parsed.shippingSummary.trim();
  const confidenceExplanation = parsed.confidenceExplanation.trim();

  const highlights = parsed.highlights
    .map((h: unknown) => String(h).trim())
    .filter(Boolean);
  const bestFor = parsed.bestFor
    .map((b: unknown) => String(b).trim())
    .filter(Boolean);
  const thingsToConsider = parsed.thingsToConsider
    .map((t: unknown) => String(t).trim())
    .filter(Boolean);

  if (highlights.length === 0) {
    throw new Error("highlights must be a non-empty array");
  }
  if (bestFor.length === 0) {
    throw new Error("bestFor must be a non-empty array");
  }

  const words = wordCount(summary);

  // Short voice: ~8–120 words (was 25–180)
  if (words < 8 || words > 120) {
    throw new Error(
      `summary length out of expected range (${words} words; expected ~8–120)`
    );
  }

  if (wordCount(overview) < 5) {
    throw new Error("overview is too short");
  }

  return {
    summary,
    overview,
    highlights,
    bestFor,
    shippingSummary,
    thingsToConsider,
    confidenceExplanation,
  };
}