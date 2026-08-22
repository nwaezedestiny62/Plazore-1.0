export type ConfidenceLevel =
  | "High Confidence"
  | "Growing Confidence"
  | "Limited Confidence";

export type AIStatus = "pending" | "ready" | "failed";

export interface PlazoreAIData {
  status: AIStatus;
  summary: string;
  overview: string;
  highlights: string[];
  bestFor: string[];
  shippingSummary: string;
  thingsToConsider: string[];
  buyerConfidence: {
    level: ConfidenceLevel;
    score: number;
    factors: string[];
  };
  confidenceExplanation: string;
  generatedAt?: string;
}