import OpenAI from "openai";
import { AIModelProvider } from "../types.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAIGPT55Provider implements AIModelProvider {
  async generate(
    systemPrompt: string,
    userPrompt: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<string> {
    const model = process.env.PLAZORE_AI_MODEL || "gpt-5.5";

    const response = await client.chat.completions.create({
      model,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return content;
  }
}