import { Request, Response } from 'express'
import Product from '../models/Products.js'

export const searchSuggest = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 1) {
      return res.json({ success: true, data: { products: [], suggestions: [], floors: [] } })
    }

    // Escape regex characters for safe querying
    const cleanQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(cleanQ, 'i')

    // 1) Algorithmic matching for products (matching name, brand, category, subCategory, description)
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
      .select('name brand category subCategory images price region fulfillmentLocation seller')
      .populate('seller', 'storeName name storeLogo')
      .limit(8)
      .lean()

    // 2) Algorithmic extraction of related category/floor suggestions from active products in DB
    const matchingCategories = await Product.distinct('category', {
      isActive: true,
      $or: [{ category: regex }, { subCategory: regex }, { brand: regex }],
    })

    // 3) Algorithmic extraction of popular tags / search phrases from matching product names & brands
    const relatedProducts = await Product.find({
      isActive: true,
      $or: [{ name: regex }, { brand: regex }],
    })
      .select('name brand subCategory')
      .limit(10)
      .lean()

    const suggestionSet = new Set<string>()
    relatedProducts.forEach((p) => {
      if (p.brand && p.brand.toLowerCase().includes(q.toLowerCase())) {
        suggestionSet.add(p.brand)
      }
      if (p.subCategory && p.subCategory.toLowerCase().includes(q.toLowerCase())) {
        suggestionSet.add(p.subCategory)
      }
      const words = p.name.split(' ')
      if (words.length >= 2) {
        suggestionSet.add(`${words[0]} ${words[1]}`)
      } else {
        suggestionSet.add(p.name)
      }
    })

    const suggestions = Array.from(suggestionSet).slice(0, 5)
    const floors = matchingCategories.slice(0, 3)

    res.json({
      success: true,
      data: {
        products,
        suggestions,
        floors,
      },
    })
  } catch (error: any) {
    console.error('searchSuggest algorithmic error:', error)
    res.status(500).json({ success: false, message: error.message || 'Search suggest failed' })
  }
}
