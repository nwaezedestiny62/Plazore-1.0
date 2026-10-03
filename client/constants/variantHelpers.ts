/** Shared variant helpers for product detail / cards */
import type { Product, ProductOption, ProductVariant } from '@/constants/types'
import { productHasVariants } from '@/constants/types'

export function normalizeProductOptions(product: Product): ProductOption[] {
  const raw = product.options
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((o) => ({
        id: String(o.id || o.name || ''),
        name: String(o.name || '').trim(),
        values: Array.isArray(o.values)
          ? o.values.map((v) => String(v).trim()).filter(Boolean)
          : [],
      }))
      .filter((o) => o.name && o.values.length)
  }
  const map: Record<string, Set<string>> = {}
  for (const v of product.variants || []) {
    for (const [k, val] of Object.entries(v.options || {})) {
      if (!map[k]) map[k] = new Set()
      if (val) map[k].add(String(val))
    }
  }
  return Object.entries(map).map(([name, set]) => ({
    id: name,
    name,
    values: Array.from(set),
  }))
}

export function matchVariant(
  product: Product,
  selected: Record<string, string>,
): ProductVariant | null {
  const list = product.variants || []
  if (!list.length) return null
  const entries = Object.entries(selected).filter(
    ([, v]) => v != null && String(v) !== '',
  )
  if (!entries.length) return null
  return (
    list.find((v) => {
      const o = v.options || {}
      return entries.every(([k, val]) => String(o[k]) === String(val))
    }) || null
  )
}

export function unitPriceForSelection(
  product: Product,
  matched: ProductVariant | null,
): number {
  if (matched && matched.price != null && Number.isFinite(Number(matched.price))) {
    return Number(matched.price)
  }
  return Number(product.price) || 0
}

export function stockForSelection(
  product: Product,
  matched: ProductVariant | null,
  hasVar: boolean,
): number {
  if (hasVar) {
    if (!matched) return 0
    if (matched.isActive === false) return 0
    return Math.max(0, Number(matched.stock) || 0)
  }
  return Math.max(0, Number(product.stock) || 0)
}

export function buildCartOpts(
  product: Product,
  selected: Record<string, string>,
  matched: ProductVariant | null,
) {
  if (!productHasVariants(product) || !matched) {
    return undefined
  }
  return {
    variantId: matched.variantId,
    variantKey: matched.variantKey,
    selectedOptions: { ...selected },
    price: unitPriceForSelection(product, matched),
    image: matched.image || product.images?.[0],
  }
}
