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
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Sony, LG, Samsung' },
    { key: 'model', label: 'Model', placeholder: 'Model name / number' },
    { key: 'color', label: 'Color', optional: true },
    { key: 'warranty', label: 'Warranty', placeholder: 'e.g. 1 year', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used / Refurbished' },
  ],
  'Phones & Accessories': [
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Apple, Samsung, Tecno' },
    { key: 'model', label: 'Model', placeholder: 'e.g. iPhone 15 Pro, S24 Ultra' },
    { key: 'storage', label: 'Storage', placeholder: 'e.g. 128GB, 256GB' },
    { key: 'ram', label: 'RAM', placeholder: 'e.g. 8GB', optional: true },
    { key: 'color', label: 'Color', placeholder: 'e.g. Space Black' },
    { key: 'network', label: 'Network', placeholder: 'e.g. 5G, Dual SIM', optional: true },
    { key: 'batteryHealth', label: 'Battery health', placeholder: 'e.g. 95%', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used / Refurbished' },
  ],
  Computers: [
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Dell, Apple, HP, Lenovo' },
    { key: 'model', label: 'Model', placeholder: 'e.g. XPS 15, MacBook Pro' },
    { key: 'processor', label: 'Processor', placeholder: 'e.g. Intel i7, M3 Pro', optional: true },
    { key: 'storage', label: 'Storage', placeholder: 'e.g. 512GB SSD' },
    { key: 'ram', label: 'RAM', placeholder: 'e.g. 16GB' },
    { key: 'graphics', label: 'Graphics', placeholder: 'e.g. RTX 4060', optional: true },
    { key: 'screenSize', label: 'Screen size', placeholder: 'e.g. 15.6"', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used / Refurbished' },
  ],
  Fashion: [
    { key: 'size', label: 'Size', placeholder: 'e.g. M, 42, UK 8, One Size' },
    { key: 'color', label: 'Color', placeholder: 'e.g. Black, Navy' },
    { key: 'material', label: 'Material', placeholder: 'e.g. Cotton, Leather, Silk', optional: true },
    { key: 'brand', label: 'Brand', placeholder: 'Brand name', optional: true },
    { key: 'gender', label: 'Gender', placeholder: 'Men / Women / Unisex / Kids', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used', optional: true },
  ],
  'Beauty & Personal Care': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'volume', label: 'Size / Volume', placeholder: 'e.g. 50ml, 200g', optional: true },
    { key: 'skinType', label: 'Skin / hair type', placeholder: 'e.g. Oily, Dry, All', optional: true },
    { key: 'shade', label: 'Shade / color', optional: true },
    { key: 'expiry', label: 'Expiry / best before', optional: true },
  ],
  'Home & Living': [
    { key: 'material', label: 'Material', optional: true },
    { key: 'color', label: 'Color', optional: true },
    { key: 'dimensions', label: 'Dimensions', placeholder: 'e.g. 40 × 40 cm', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
  ],
  Furniture: [
    { key: 'material', label: 'Material', placeholder: 'e.g. Oak, Metal, Fabric' },
    { key: 'dimensions', label: 'Dimensions', placeholder: 'e.g. 120 × 60 × 75 cm' },
    { key: 'color', label: 'Color' },
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used' },
  ],
  'Kitchen & Dining': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'material', label: 'Material', placeholder: 'e.g. Stainless steel, Ceramic', optional: true },
    { key: 'capacity', label: 'Capacity', placeholder: 'e.g. 1.5L, 6-set', optional: true },
    { key: 'color', label: 'Color', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  Groceries: [
    { key: 'weight', label: 'Weight / Volume', placeholder: 'e.g. 500g, 1L', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'expiry', label: 'Best before', optional: true },
    { key: 'packSize', label: 'Pack size', placeholder: 'e.g. Pack of 6', optional: true },
  ],
  Health: [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'quantity', label: 'Quantity', placeholder: 'e.g. 60 tablets', optional: true },
    { key: 'dosage', label: 'Dosage / strength', optional: true },
    { key: 'expiry', label: 'Expiry date', optional: true },
  ],
  'Sports & Outdoors': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'size', label: 'Size', optional: true },
    { key: 'color', label: 'Color', optional: true },
    { key: 'material', label: 'Material', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  Automotive: [
    { key: 'brand', label: 'Make / Brand', placeholder: 'e.g. Toyota, Honda' },
    { key: 'model', label: 'Model', placeholder: 'e.g. Camry, Civic' },
    { key: 'year', label: 'Year', placeholder: 'e.g. 2019' },
    { key: 'mileage', label: 'Mileage', placeholder: 'e.g. 45,000 km', optional: true },
    { key: 'fuelType', label: 'Fuel type', placeholder: 'Petrol / Diesel / Hybrid / Electric' },
    { key: 'transmission', label: 'Transmission', placeholder: 'Automatic / Manual' },
    { key: 'engineSize', label: 'Engine size', placeholder: 'e.g. 2.0L', optional: true },
    { key: 'bodyType', label: 'Body type', placeholder: 'Sedan / SUV / Hatchback', optional: true },
    { key: 'vin', label: 'VIN / Chassis no.', optional: true },
    { key: 'color', label: 'Color' },
    { key: 'condition', label: 'Condition', placeholder: 'Used / Certified pre-owned' },
  ],
  'Spare Parts & Components': [
    { key: 'brand', label: 'Brand / OEM', placeholder: 'e.g. Bosch, OEM Toyota', optional: true },
    { key: 'partNumber', label: 'Part number', optional: true },
    { key: 'compatibleWith', label: 'Compatible with', placeholder: 'e.g. Toyota Camry 2015–2020' },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used / Refurbished' },
  ],
  Books: [
    { key: 'author', label: 'Author', optional: true },
    { key: 'publisher', label: 'Publisher', optional: true },
    { key: 'format', label: 'Format', placeholder: 'Hardcover / Paperback / Ebook', optional: true },
    { key: 'language', label: 'Language', optional: true },
    { key: 'isbn', label: 'ISBN', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Office Supplies': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'color', label: 'Color', optional: true },
    { key: 'quantity', label: 'Quantity / pack size', optional: true },
  ],
  'Toys & Games': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'ageRange', label: 'Age range', placeholder: 'e.g. 3+', optional: true },
    { key: 'players', label: 'Players', placeholder: 'e.g. 2–4', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Baby Products': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'size', label: 'Size', optional: true },
    { key: 'ageRange', label: 'Age range', placeholder: 'e.g. 0–6 months', optional: true },
    { key: 'weightLimit', label: 'Weight limit', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Pet Supplies': [
    { key: 'petType', label: 'Pet type', placeholder: 'Dog / Cat / Bird / Fish / Other' },
    { key: 'breed', label: 'Breed', optional: true },
    { key: 'size', label: 'Size', placeholder: 'e.g. Small, Medium, Large', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'age', label: 'Age', optional: true },
    { key: 'weight', label: 'Weight / pack size', optional: true },
  ],
  'Jewelry & Watches': [
    { key: 'material', label: 'Material', placeholder: 'e.g. Gold, Silver, Stainless steel' },
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'color', label: 'Color / finish', optional: true },
    { key: 'size', label: 'Size / length', optional: true },
    { key: 'gemstone', label: 'Gemstone', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Musical Instruments': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'model', label: 'Model', optional: true },
    { key: 'type', label: 'Type', placeholder: 'e.g. Acoustic, Electric', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used' },
  ],
  'Art & Crafts': [
    { key: 'medium', label: 'Medium', placeholder: 'e.g. Oil, Acrylic, Digital', optional: true },
    { key: 'dimensions', label: 'Dimensions', optional: true },
    { key: 'artist', label: 'Artist', optional: true },
    { key: 'year', label: 'Year created', optional: true },
  ],
  'Industrial & Scientific': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'model', label: 'Model', optional: true },
    { key: 'power', label: 'Power / capacity', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used' },
  ],
  'Industrial Equipment': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'model', label: 'Model', optional: true },
    { key: 'power', label: 'Power / capacity', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'New / Used' },
  ],
  Agriculture: [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'quantity', label: 'Quantity / weight', optional: true },
    { key: 'variety', label: 'Variety / type', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Building Materials': [
    { key: 'material', label: 'Material', optional: true },
    { key: 'dimensions', label: 'Dimensions', optional: true },
    { key: 'quantity', label: 'Quantity', placeholder: 'e.g. 50 bags, 10 pieces', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
  ],
  Collectibles: [
    { key: 'year', label: 'Year', optional: true },
    { key: 'condition', label: 'Condition', placeholder: 'Mint / Near mint / Used', optional: true },
    { key: 'authenticity', label: 'Authenticity', placeholder: 'Certified / Unverified', optional: true },
  ],
  'Luxury Goods': [
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model / style', optional: true },
    { key: 'material', label: 'Material', optional: true },
    { key: 'color', label: 'Color', optional: true },
    { key: 'serialNumber', label: 'Serial number', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Tools & Hardware': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'model', label: 'Model', optional: true },
    { key: 'powerSource', label: 'Power source', placeholder: 'Corded / Cordless / Manual', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Garden & Outdoor': [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'dimensions', label: 'Dimensions', optional: true },
    { key: 'material', label: 'Material', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
  ],
  'Event & Party': [
    { key: 'quantity', label: 'Quantity / pack size', optional: true },
    { key: 'color', label: 'Color / theme', optional: true },
    { key: 'occasion', label: 'Occasion', optional: true },
  ],
  Services: [
    { key: 'serviceArea', label: 'Service area', placeholder: 'e.g. Lagos, Nationwide', optional: true },
    { key: 'duration', label: 'Duration / package', placeholder: 'e.g. 1 hour, Monthly', optional: true },
    { key: 'experience', label: 'Experience', placeholder: 'e.g. 5+ years', optional: true },
  ],
  'Digital Products': [
    { key: 'format', label: 'Format', placeholder: 'e.g. PDF, MP4, ZIP', optional: true },
    { key: 'license', label: 'License type', placeholder: 'Personal / Commercial', optional: true },
    { key: 'delivery', label: 'Delivery', placeholder: 'Instant download / Email', optional: true },
  ],
  'Real Estate': [
    { key: 'propertyType', label: 'Property type', placeholder: 'Apartment / House / Land / Shop' },
    { key: 'bedrooms', label: 'Bedrooms', placeholder: 'e.g. 3', optional: true },
    { key: 'bathrooms', label: 'Bathrooms', placeholder: 'e.g. 2', optional: true },
    { key: 'size', label: 'Size', placeholder: 'e.g. 120 sqm, 500 sqm', optional: true },
    { key: 'furnishing', label: 'Furnishing', placeholder: 'Furnished / Semi / Unfurnished', optional: true },
    { key: 'listingType', label: 'Listing type', placeholder: 'Sale / Rent / Short stay' },
  ],
  'Food & Restaurants': [
    { key: 'servings', label: 'Servings / portion', optional: true },
    { key: 'cuisine', label: 'Cuisine', optional: true },
    { key: 'dietary', label: 'Dietary', placeholder: 'Halal / Vegan / Gluten-free', optional: true },
  ],
  'Wholesale & Bulk': [
    { key: 'minOrder', label: 'Minimum order', placeholder: 'e.g. 50 units', optional: true },
    { key: 'unitPrice', label: 'Unit / pack info', optional: true },
    { key: 'brand', label: 'Brand', optional: true },
  ],
  Others: [
    { key: 'brand', label: 'Brand', optional: true },
    { key: 'condition', label: 'Condition', optional: true },
    { key: 'dimensions', label: 'Dimensions', optional: true },
  ],
}

/** Categories where verification docs are recommended / required */
export const DOC_REQUIRED_CATEGORIES = [
  'Automotive',
  'Real Estate',
  'Building Materials',
  'Industrial Equipment',
  'Industrial & Scientific',
  'Luxury Goods',
  'Spare Parts & Components',
]

export const DOC_TYPES_BY_CATEGORY: Record<string, DocTypeOption[]> = {
  Automotive: [
    { id: 'vehicle_registration', label: 'Vehicle registration' },
    { id: 'proof_of_ownership', label: 'Proof of ownership' },
    { id: 'service_records', label: 'Service / maintenance records' },
    { id: 'roadworthiness', label: 'Roadworthiness / inspection' },
    { id: 'insurance', label: 'Insurance document' },
  ],
  'Real Estate': [
    { id: 'survey_plan', label: 'Survey plan' },
    { id: 'certificate_of_occupancy', label: 'Certificate of occupancy (C of O)' },
    { id: 'deed_of_assignment', label: 'Deed of assignment' },
    { id: 'proof_of_ownership', label: 'Proof of ownership' },
    { id: 'governor_consent', label: 'Governor’s consent' },
    { id: 'tax_clearance', label: 'Tax clearance' },
  ],
  'Building Materials': [
    { id: 'survey_plan', label: 'Survey plan' },
    { id: 'certificate_of_occupancy', label: 'Certificate of occupancy' },
    { id: 'proof_of_ownership', label: 'Proof of ownership' },
    { id: 'invoice', label: 'Supplier invoice' },
  ],
  'Industrial Equipment': [
    { id: 'service_records', label: 'Service records' },
    { id: 'proof_of_ownership', label: 'Proof of ownership' },
    { id: 'manual', label: 'User / service manual' },
    { id: 'warranty', label: 'Warranty document' },
  ],
  'Industrial & Scientific': [
    { id: 'service_records', label: 'Service records' },
    { id: 'proof_of_ownership', label: 'Proof of ownership' },
    { id: 'calibration', label: 'Calibration certificate' },
    { id: 'manual', label: 'User / service manual' },
  ],
  'Luxury Goods': [
    { id: 'authenticity', label: 'Authenticity certificate' },
    { id: 'purchase_receipt', label: 'Original purchase receipt' },
    { id: 'serial_card', label: 'Serial / authenticity card' },
  ],
  'Spare Parts & Components': [
    { id: 'invoice', label: 'Supplier invoice' },
    { id: 'compatibility', label: 'Compatibility / fitment note' },
    { id: 'warranty', label: 'Warranty document' },
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