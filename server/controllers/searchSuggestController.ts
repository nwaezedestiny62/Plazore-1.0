import { Request, Response } from 'express'
import Product from '../models/Products.js'

export const searchSuggest = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim()

    if (q.length < 1) {
      return res.json({
        success: true,
        data: { products: [], suggestions: [], floors: [] },
      })
    }

    // Escape special regex characters
    const cleanQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(cleanQ, 'i')

    // 1. Product matches
    const products = await Product.find({
      isActive: true,
      $or: [
        { name: regex },
        { brand: regex },
        { category: regex },
        { subCategory: regex },
        { description: regex },
      ],
    })
      .select('name brand category subCategory images price region seller')
      .populate('seller', 'storeName name storeLogo')
      .limit(8)
      .lean()

    // 2. Matching categories (floors)
    const matchingCategories = await Product.distinct('category', {
      isActive: true,
      $or: [
        { category: regex },
        { subCategory: regex },
        { brand: regex },
        { name: regex },
      ],
    })

    // 3. Generate smart suggestions from real data
    const relatedProducts = await Product.find({
      isActive: true,
      $or: [{ name: regex }, { brand: regex }, { subCategory: regex }],
    })
      .select('name brand subCategory')
      .limit(12)
      .lean()

    const suggestionSet = new Set<string>()

    relatedProducts.forEach((p) => {
      // Prefer brand if it matches
      if (p.brand && p.brand.toLowerCase().includes(q.toLowerCase())) {
        suggestionSet.add(p.brand.trim())
      }

      // Prefer subcategory
      if (p.subCategory && p.subCategory.toLowerCase().includes(q.toLowerCase())) {
        suggestionSet.add(p.subCategory.trim())
      }

      // Take first 2 words of product name as a phrase
      const words = p.name.trim().split(/\s+/)
      if (words.length >= 2) {
        suggestionSet.add(`${words[0]} ${words[1]}`)
      } else if (words.length === 1) {
        suggestionSet.add(words[0])
      }
    })

    // Remove the original query itself from suggestions
    suggestionSet.delete(q)
    suggestionSet.delete(q.toLowerCase())

    const suggestions = Array.from(suggestionSet).slice(0, 5)
    const floors = matchingCategories.slice(0, 4)

    return res.json({
      success: true,
      data: {
        products,
        suggestions,
        floors,
      },
    })
  } catch (error: any) {
    console.error('searchSuggest algorithmic error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Search suggest failed',
    })
  }
}