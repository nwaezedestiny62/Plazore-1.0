import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIModelProvider } from "../types.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export class GeminiFlashProvider implements AIModelProvider {
  async generate(
    systemPrompt: string,
    userPrompt: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<string> {
    const modelName = process.env.PLAZORE_AI_MODEL || "gemini-3.5-flash-lite";

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxTokens ?? 1200,
        responseMimeType: "application/json",
      },
    });

    // Gemini works better when system + user are combined cleanly
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    return text;
  }
}