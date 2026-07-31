export const PRODUCT_CATEGORIES: Record<string, string[]> = {
  Electronics: ['TVs', 'Audio', 'Cameras', 'Smart Home', 'Wearables', 'Other'],
  'Phones & Accessories': ['Smartphones', 'Cases', 'Chargers', 'Power Banks', 'Other'],
  Computers: ['Laptops', 'Desktops', 'Monitors', 'Components', 'Peripherals', 'Other'],
  Fashion: ['Men', 'Women', 'Kids', 'Shoes', 'Bags', 'Accessories', 'Other'],
  'Beauty & Personal Care': ['Skincare', 'Makeup', 'Haircare', 'Fragrance', 'Other'],
  'Home & Living': ['Decor', 'Bedding', 'Bath', 'Lighting', 'Storage', 'Other'],
  Furniture: ['Living Room', 'Bedroom', 'Office', 'Outdoor', 'Other'],
  'Kitchen & Dining': ['Cookware', 'Appliances', 'Tableware', 'Other'],
  Groceries: ['Food', 'Beverages', 'Snacks', 'Pantry', 'Other'],
  Health: ['Supplements', 'Medical Devices', 'Wellness', 'Other'],
  'Sports & Outdoors': ['Fitness', 'Camping', 'Cycling', 'Team Sports', 'Other'],
  Automotive: ['Parts', 'Accessories', 'Tools', 'Other'],
  Books: ['Fiction', 'Non-Fiction', 'Educational', 'Other'],
  'Office Supplies': ['Stationery', 'Furniture', 'Electronics', 'Other'],
  'Toys & Games': ['Toys', 'Board Games', 'Outdoor Play', 'Other'],
  'Baby Products': ['Gear', 'Feeding', 'Clothing', 'Other'],
  'Pet Supplies': ['Dogs', 'Cats', 'Other Pets', 'Other'],
  'Jewelry & Watches': ['Jewelry', 'Watches', 'Other'],
  'Musical Instruments': ['Guitars', 'Keys', 'Drums', 'Accessories', 'Other'],
  'Art & Crafts': ['Supplies', 'Finished Art', 'Other'],
  'Industrial Equipment': ['Tools', 'Machinery', 'Safety', 'Other'],
  Agriculture: ['Seeds', 'Tools', 'Equipment', 'Other'],
  'Building Materials': ['Hardware', 'Finishes', 'Other'],
  Collectibles: ['Memorabilia', 'Trading Cards', 'Other'],
  'Luxury Goods': ['Fashion', 'Accessories', 'Other'],
  Others: ['General', 'Uncategorized'],
}

export const CATEGORY_LIST = Object.keys(PRODUCT_CATEGORIES)

export const PLAN_IMAGE_LIMITS: Record<string, number> = {
  free: 6,
  pro: 12,
  business: 20,
}

export const PLAN_FEES: Record<string, number> = {
  free: 8,
  pro: 5,
  business: 3,
}