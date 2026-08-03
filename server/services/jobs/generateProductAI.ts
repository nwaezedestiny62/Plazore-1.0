import { generateProductAI } from "../plazoreAI/index.js";

const queue: string[] = [];
let isProcessing = false;

/**
 * Enqueue a product for AI generation.
 * Safe to call multiple times — duplicates are ignored while processing.
 */
export function enqueueProductAI(productId: string) {
  if (!queue.includes(productId)) {
    queue.push(productId);
  }
  processQueue();
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const productId = queue.shift()!;
    try {
      console.log(`[Plazore AI Job] Starting generation for ${productId}`);
      await generateProductAI(productId);
      console.log(`[Plazore AI Job] Completed for ${productId}`);
    } catch (err: any) {
      console.error(`[Plazore AI Job] Failed for ${productId}:`, err.message);
      // Optional: simple retry once
      // queue.push(productId);
    }
  }

  isProcessing = false;
}