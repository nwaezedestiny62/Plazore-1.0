export type SpecField = {
  key: string
  label: string
  placeholder?: string
  optional?: boolean
}

export type DocTypeOption = {
  id: string
  label: string
}

/**
 * Keys MUST match PRODUCT_CATEGORIES in productCatalog.ts
 */
export const SPEC_FIELDS_BY_CATEGORY: Record<string, SpecField[]> = {
  Electronics: [
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Sony, LG' },
    { key: 'model', label: 'Model', placeholder: 'Model name' },
    { key: 'color', label: 'Color', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used' },
  ],
  'Phones & Accessories': [
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Apple, Samsung' },
    { key: 'model', label: 'Model', placeholder: 'e.g. iPhone 15 Pro' },
    { key: 'storage', label: 'Storage', placeholder: 'e.g. 256GB' },
    { key: 'ram', label: 'RAM', placeholder: 'e.g. 8GB' },
    { key: 'color', label: 'Color', placeholder: 'e.g. Space Black' },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used / Refurbished' },
  ],
  Computers: [
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Dell, Apple' },
    { key: 'model', label: 'Model', placeholder: 'e.g. XPS 15' },
    { key: 'storage', label: 'Storage', placeholder: 'e.g. 512GB SSD' },
    { key: 'ram', label: 'RAM', placeholder: 'e.g. 16GB' },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used' },
  ],
  Fashion: [
    { key: 'size', label: 'Size', placeholder: 'e.g. M, 42, One Size' },
    { key: 'color', label: 'Color', placeholder: 'e.g. Honey, Black' },
    { key: 'material', label: 'Material', placeholder: 'e.g. Cotton, Silk' },
    { key: 'brand', label: 'Brand', placeholder: 'Brand name', optional: true },
  ],
  'Beauty & Personal Care': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'volume', label: 'Size / Volume', placeholder: 'e.g. 50ml', optional: true },
    { key: 'skinType', label: 'Skin type', optional: true },
  ],
  'Home & Living': [
    { key: 'material', label: 'Material', optional: true },
    { key: 'color', label: 'Color', optional: true },
    { key: 'dimensions', label: 'Dimensions', placeholder: 'e.g. 40 × 40 cm', optional: true },
  ],
  Furniture: [
    { key: 'material', label: 'Material', placeholder: 'e.g. Oak, Metal' },
    { key: 'dimensions', label: 'Dimensions', placeholder: 'e.g. 120 × 60 × 75 cm' },
    { key: 'color', label: 'Color' },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used' },
  ],
  'Kitchen & Dining': [
    { key: 'material', label: 'Material', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'color', label: 'Color', optional: true },
  ],
  Groceries: [
    { key: 'weight', label: 'Weight / Volume', placeholder: 'e.g. 500g, 1L', optional: true },
    { key: 'expiry', label: 'Best before', optional: true },
  ],
  Health: [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'quantity', label: 'Quantity', optional: true },
  ],
  'Sports & Outdoors': [
    { key: 'size', label: 'Size', optional: true },
    { key: 'color', label: 'Color', optional: true },
    { key: 'material', label: 'Material', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
  ],
  Automotive: [
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Toyota' },
    { key: 'model', label: 'Model', placeholder: 'e.g. Camry' },
    { key: 'year', label: 'Year', placeholder: 'e.g. 2019' },
    { key: 'mileage', label: 'Mileage', placeholder: 'e.g. 45,000 km' },
    { key: 'fuelType', label: 'Fuel Type', placeholder: 'Petrol / Diesel / Hybrid / Electric' },
    { key: 'transmission', label: 'Transmission', placeholder: 'Automatic / Manual' },
    { key: 'color', label: 'Color' },
    { key: 'condition', label: 'Condition', placeholder: 'Used / Certified' },
  ],
  Books: [
    { key: 'author', label: 'Author', optional: true },
    { key: 'format', label: 'Format', placeholder: 'Hardcover / Paperback', optional: true },
    { key: 'language', label: 'Language', optional: true },
  ],
  'Office Supplies': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'color', label: 'Color', optional: true },
  ],
  'Toys & Games': [
    { key: 'ageRange', label: 'Age range', placeholder: 'e.g. 3+', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
  ],
  'Baby Products': [
    { key: 'size', label: 'Size', optional: true },
    { key: 'ageRange', label: 'Age range', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
  ],
  'Pet Supplies': [
    { key: 'petType', label: 'Pet type', placeholder: 'Dog / Cat', optional: true },
    { key: 'size', label: 'Size', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
  ],
  'Jewelry & Watches': [
    { key: 'material', label: 'Material', placeholder: 'e.g. Gold, Silver' },
    { key: 'color', label: 'Color', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
  ],
  'Musical Instruments': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Art & Crafts': [
    { key: 'medium', label: 'Medium', optional: true },
    { key: 'dimensions', label: 'Dimensions', optional: true },
  ],
  'Industrial Equipment': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'model', label: 'Model', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used' },
  ],
  Agriculture: [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'quantity', label: 'Quantity / Weight', optional: true },
  ],
  'Building Materials': [
    { key: 'material', label: 'Material', optional: true },
    { key: 'dimensions', label: 'Dimensions', optional: true },
    { key: 'quantity', label: 'Quantity', optional: true },
  ],
  Collectibles: [
    { key: 'condition', label: 'Condition', optional: true },
    { key: 'year', label: 'Year', optional: true },
  ],
  'Luxury Goods': [
    { key: 'brand', label: 'Brand' },
    { key: 'material', label: 'Material', optional: true },
    { key: 'color', label: 'Color', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  Others: [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
}

/** Only categories where verification docs matter */
export const DOC_REQUIRED_CATEGORIES = [
  'Automotive',
  'Building Materials',
  'Industrial Equipment',
]

export const DOC_TYPES_BY_CATEGORY: Record<string, DocTypeOption[]> = {
  Automotive: [
    { id: 'vehicle_registration', label: 'Vehicle Registration' },
    { id: 'proof_of_ownership', label: 'Proof of Ownership' },
    { id: 'service_records', label: 'Service Records' },
  ],
  'Building Materials': [
    { id: 'survey_plan', label: 'Survey Plan' },
    { id: 'certificate_of_occupancy', label: 'Certificate of Occupancy' },
    { id: 'proof_of_ownership', label: 'Proof of Ownership' },
  ],
  'Industrial Equipment': [
    { id: 'service_records', label: 'Service Records' },
    { id: 'proof_of_ownership', label: 'Proof of Ownership' },
  ],
}

export function getSpecFields(category: string): SpecField[] {
  return SPEC_FIELDS_BY_CATEGORY[category] || SPEC_FIELDS_BY_CATEGORY.Others
}

export function categoryNeedsDocs(category: string): boolean {
  return DOC_REQUIRED_CATEGORIES.includes(category)
}

export function getDocTypes(category: string): DocTypeOption[] {
  return DOC_TYPES_BY_CATEGORY[category] || []
}