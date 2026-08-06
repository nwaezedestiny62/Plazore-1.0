import { Request, Response } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Product from '../models/Products.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export const searchSuggest = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 2) {
      return res.json({ success: true, data: { products: [], suggestions: [], floors: [] } })
    }

    // 1) DB hits first (never stupid)
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const products = await Product.find({
      isActive: true,
      $or: [
        { name: regex },
        { brand: regex },
        { description: regex },
        { category: regex },
        { subCategory: regex },
      ],
    })
      .select('name brand category subCategory images price region fulfillmentLocation')
      .limit(8)
      .lean()

    // 2) Catalog snapshot for Gemini
    const catalog = await Product.find({ isActive: true })
      .select('name brand category subCategory')
      .limit(80)
      .lean()

    const catalogText = catalog
      .map((p) => `${p.name} | ${p.brand || ''} | ${p.category || ''} | ${p.subCategory || ''}`)
      .join('\n')

    let suggestions: string[] = []
    let floors: string[] = []

    if (process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const prompt = `You are the Plazore mall directory search assistant.
User typed: "${q}"

Catalog (name | brand | category | subCategory):
${catalogText}

Return ONLY valid JSON:
{
  "suggestions": ["short search phrases the user might mean, max 5"],
  "floors": ["matching category names from catalog only, max 3"]
}

Rules:
- Prefer real brands/products/categories from the catalog
- Fix typos and expand intent (e.g. "fone" → "phone", "sneakers")
- No offers, no prices, no marketing fluff
- If catalog is empty, still suggest sensible mall search phrases`

        const result = await model.generateContent(prompt)
        const raw = result.response.text().replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions.slice(0, 5)
        if (Array.isArray(parsed.floors)) floors = parsed.floors.slice(0, 3)
      } catch (e) {
        console.log('Gemini suggest fallback:', e)
      }
    }

    res.json({
      success: true,
      data: {
        products,
        suggestions,
        floors,
      },
    })
  } catch (error: any) {
    console.error('searchSuggest:', error)
    res.status(500).json({ success: false, message: error.message || 'Suggest failed' })
  }
}