export type HelpArticle = {
  id: string
  title: string
  body: string
}

export type HelpCategory = {
  id: string
  title: string
  intro?: string
  articles: HelpArticle[]
}

export const HELP_QUICK: {
  id: string
  title: string
  subtitle: string
  icon: string
  route?: string
  categoryId?: string
}[] = [
  {
    id: 'track',
    title: 'Track an order',
    subtitle: 'See where your order is and what happens next.',
    icon: 'cube-outline',
    route: '/orders',
  },
  {
    id: 'contact',
    title: 'Contact Plazore',
    subtitle: 'Orders, payments, account, store, or something else.',
    icon: 'chatbubbles-outline',
    route: '/contact',
  },
  {
    id: 'shopping',
    title: 'Shopping help',
    subtitle: 'Browse, cart, checkout, and purchases.',
    icon: 'bag-handle-outline',
    categoryId: 'shopping',
  },
  {
    id: 'selling',
    title: 'Selling help',
    subtitle: 'Stores, products, orders, and seller tools.',
    icon: 'storefront-outline',
    categoryId: 'selling',
  },
]

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'how-it-works',
    title: 'How Plazore Works',
    intro:
      'Plazore is a discovery-first marketplace. You can browse, understand a product, pay, track, and confirm — all in one flow.',
    articles: [
      {
        id: 'discover',
        title: 'Discover',
        body:
          'Browse the Plazore showroom or search for something specific. Plazore is built for both intentional shopping and discovering products you may not have been looking for yet.',
      },
      {
        id: 'explore-product',
        title: 'Explore a product',
        body:
          'Open a product to view its information, seller, availability, images, and other relevant details before you decide.',
      },
      {
        id: 'understand',
        title: 'Understand before you buy',
        body:
          'Where enough information is available, Plazore AI and Buyer Confidence help you understand a product faster. They support your decision — they do not make the purchase for you.',
      },
      {
        id: 'add-cart',
        title: 'Add to cart',
        body:
          'Choose the product and any available options, select your quantity, and add it to your cart.',
      },
      {
        id: 'checkout',
        title: 'Checkout',
        body:
          'Review your order, delivery information, and total before continuing to payment.',
      },
      {
        id: 'pay',
        title: 'Pay',
        body:
          'Complete payment through Plazore’s supported payment system. Do not pay sellers separately outside checkout.',
      },
      {
        id: 'track',
        title: 'Track',
        body:
          'Follow your order through processing, shipping, and delivery from your Orders section.',
      },
      {
        id: 'confirm',
        title: 'Confirm',
        body:
          'After the seller marks the order as delivered, you can confirm that you received it or raise an issue if something is wrong.',
      },
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping on Plazore',
    articles: [
      {
        id: 'find-products',
        title: 'How do I find products?',
        body:
          'Search when you know what you want, or browse the showroom to discover products naturally.',
      },
      {
        id: 'showroom',
        title: 'How does the showroom work?',
        body:
          'The showroom organizes available products using relevance, availability, marketplace activity, discovery signals, and how you interact with Plazore. It helps you discover without needing to know exactly what you want first.',
      },
      {
        id: 'search-vs-browse',
        title: 'Can I search instead of browse?',
        body:
          'Yes. Plazore supports both. Search for something specific; explore when you want to discover something new.',
      },
      {
        id: 'add-to-cart',
        title: 'How do I add something to my cart?',
        body:
          'Open the product, choose any required options, select your quantity, and select Add to Cart.',
      },
      {
        id: 'change-cart',
        title: 'Can I change my cart?',
        body:
          'Yes. Review your cart, change quantities or available options, remove products, and check the order before checkout.',
      },
      {
        id: 'cart-notes',
        title: 'What are cart notes?',
        body:
          'Where supported, cart notes let you add clear information useful for fulfilment or delivery. Keep them relevant.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    articles: [
      {
        id: 'how-pay',
        title: 'How do I pay?',
        body:
          'At checkout, review your order and continue with the payment method provided by Plazore.',
      },
      {
        id: 'who-handles',
        title: 'Is my payment handled by Plazore?',
        body:
          'Plazore manages the commerce and order experience. Supported payment infrastructure processes the transaction itself.',
      },
      {
        id: 'after-pay',
        title: 'What happens after I pay?',
        body:
          'Your order is created and moves through Plazore’s order process. Track status anytime in Orders.',
      },
      {
        id: 'pay-problem',
        title: 'What if my payment has a problem?',
        body:
          'Do not pay the seller outside Plazore checkout. If payment or the order has a problem, use Contact Plazore and include the relevant order details.',
      },
    ],
  },
  {
    id: 'orders',
    title: 'Orders & Delivery',
    intro: 'Orders move through clear stages so you always know where things stand.',
    articles: [
      {
        id: 'paid',
        title: 'Paid',
        body:
          'Your payment was processed successfully and the order has been created on Plazore.',
      },
      {
        id: 'processing',
        title: 'Processing',
        body: 'The seller is preparing your order for dispatch.',
      },
      {
        id: 'shipped',
        title: 'Shipped',
        body: 'Your order has been dispatched for delivery.',
      },
      {
        id: 'delivered',
        title: 'Delivered',
        body: 'The seller has marked your order as delivered.',
      },
      {
        id: 'confirm-delivery',
        title: 'Confirm delivery',
        body:
          'If you received the order and everything is correct, confirm delivery. That helps complete the commerce cycle for both you and the seller.',
      },
      {
        id: 'order-issues',
        title: 'What if something is wrong?',
        body:
          'If you did not receive the order or something is wrong, use the issue option and Contact Plazore with the order context. Examples include not received, marked delivered incorrectly, wrong or damaged product, missing item, or a delivery problem.',
      },
    ],
  },
  {
    id: 'protection',
    title: 'Buyer Protection',
    intro:
      'Plazore is designed to give buyers a structured commerce experience instead of leaving every transaction to an informal chat with a seller.',
    articles: [
      {
        id: 'how-protect',
        title: 'How does Plazore support buyers?',
        body:
          'Orders are recorded in Plazore. Payment goes through supported payment infrastructure. Delivery status is tracked. You can confirm delivery or raise an issue. When needed, Plazore can review relevant order, seller, product, payment, and delivery information.',
      },
      {
        id: 'if-wrong',
        title: 'If something goes wrong',
        body:
          'Contact Plazore rather than arranging payment or resolution outside the platform. Issues may include: order not received, marked delivered but not received, wrong product, damaged product, missing item, delivery problems, or other concerns. Resolution depends on the facts of each case — Plazore does not guarantee an automatic refund for every issue.',
      },
    ],
  },
  {
    id: 'selling',
    title: 'Selling on Plazore',
    articles: [
      {
        id: 'become-seller',
        title: 'How do I become a seller?',
        body:
          'Create or activate your seller presence through the available seller setup and complete the required information.',
      },
      {
        id: 'add-product',
        title: 'How do I add a product?',
        body:
          'Create a listing with accurate product information, permitted images, price, and availability, then publish when ready.',
      },
      {
        id: 'seller-orders',
        title: 'How do orders work for sellers?',
        body:
          'When a buyer purchases your product, the order appears in your seller order area. Fulfil it and update the order through the available stages.',
      },
      {
        id: 'payouts',
        title: 'How do seller payouts work?',
        body:
          'Payout eligibility is connected to order completion and Plazore’s payout process. Marking an order as delivered does not by itself mean the transaction is immediately completed or paid out.',
      },
      {
        id: 'product-info',
        title: 'Why does product information matter?',
        body:
          'Accurate details help buyers understand what they are purchasing and give Plazore better information for discovery and product intelligence.',
      },
    ],
  },
  {
    id: 'seller-world',
    title: 'Seller World',
    intro:
      'Seller World is the seller’s business environment inside Plazore — store, products, orders, activity, and related tools in one place.',
    articles: [
      {
        id: 'manage-store',
        title: 'Managing my store',
        body:
          'Use Seller World to keep store details, visibility, and business settings accurate so buyers can find and trust your storefront.',
      },
      {
        id: 'manage-products',
        title: 'Managing products',
        body:
          'Add, edit, activate, or retire listings. Keep stock, pricing, and product details up to date.',
      },
      {
        id: 'manage-orders-sw',
        title: 'Managing orders',
        body:
          'Process new orders, update fulfilment stages, and respond to buyer messages tied to your products.',
      },
      {
        id: 'store-activity',
        title: 'Understanding store activity',
        body:
          'Seller tools surface commerce activity around your products and orders so you can see what is moving and what needs attention.',
      },
      {
        id: 'visibility',
        title: 'Seller visibility',
        body:
          'Clear product information, active listings, and healthy order handling help your store and products be discovered in the showroom and search.',
      },
      {
        id: 'plans',
        title: 'Seller plans',
        body:
          'Where plans are available in the app, they relate to how you operate as a seller on Plazore. Review plan details inside Seller World before changing anything.',
      },
      {
        id: 'seller-payouts-sw',
        title: 'Seller payouts',
        body:
          'Payouts follow Plazore’s completion and eligibility rules. Check seller order and payout status in your storefront tools rather than assuming immediate payment after marking delivered.',
      },
    ],
  },
  {
    id: 'ai',
    title: 'Plazore AI',
    intro:
      'Plazore AI is built for product and commerce intelligence — not generic chat.',
    articles: [
      {
        id: 'what-ai',
        title: 'What is Plazore AI?',
        body:
          'Plazore AI turns available product information and marketplace activity into useful context so buyers can understand products faster and sellers can better understand their commerce activity.',
      },
      {
        id: 'ai-decide',
        title: 'Does Plazore AI choose what I buy?',
        body:
          'No. It supports your decision. You remain responsible for what you purchase.',
      },
      {
        id: 'buyer-confidence',
        title: 'What is Buyer Confidence?',
        body:
          'Buyer Confidence indicates how much useful supporting information and marketplace activity is available for a product. It is context, not a star rating or a guarantee. States may include High Confidence, Growing, or Limited. Limited does not mean a product is bad — it can simply mean there is not enough supporting information or activity yet.',
      },
      {
        id: 'ai-sellers',
        title: 'How does Plazore AI help sellers?',
        body:
          'It can help sellers understand product and commerce activity, notice meaningful changes, and turn marketplace information into clearer business context.',
      },
    ],
  },
  {
    id: 'discovery',
    title: 'Discovery',
    articles: [
      {
        id: 'how-discovery',
        title: 'How does discovery work?',
        body:
          'Plazore’s discovery system uses marketplace and interaction signals to improve what products are surfaced over time. Signals can include product views, clicks, time spent, category activity, searches, add-to-cart, checkout, purchases, store visits, and other available commerce signals.',
      },
      {
        id: 'signal-weight',
        title: 'Does one click change everything?',
        body:
          'No. A single click does not rewrite your whole experience. Stronger signals such as purchases, checkout, and add-to-cart can carry more weight than light browsing.',
      },
      {
        id: 'not-only-ai',
        title: 'Is the showroom only AI?',
        body:
          'No. The showroom combines marketplace fundamentals with discovery and personalization signals. It is not claimed to be powered only by AI.',
      },
    ],
  },
  {
    id: 'banners',
    title: 'Plazore Banners',
    articles: [
      {
        id: 'banner-types',
        title: 'What are Plazore banners?',
        body:
          'Some banners are personalized using marketplace and interaction signals. Others are controlled by Plazore administration for platform messaging, campaigns, and marketplace communication.',
      },
      {
        id: 'banner-cycle',
        title: 'How often do personalized banners update?',
        body:
          'Personalized banners refresh according to Plazore’s defined personalization cycle — not on every single tap.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & Settings',
    articles: [
      {
        id: 'manage-account',
        title: 'Managing my account',
        body:
          'Open Profile and Settings to review account details, security-related options available in the app, and how you use Plazore.',
      },
      {
        id: 'profile',
        title: 'Updating my profile',
        body:
          'Update your profile information from Profile or Settings → Profile so your account stays accurate.',
      },
      {
        id: 'notifications',
        title: 'Notifications',
        body:
          'Order, chat, and platform notices appear in Notifications. You can also review notification preferences under Settings where available.',
      },
      {
        id: 'privacy',
        title: 'Privacy',
        body:
          'Review privacy-related options in Settings → Privacy. Contact Plazore if you need help with an account privacy concern.',
      },
      {
        id: 'saved',
        title: 'Saved items',
        body:
          'Wishlist and saved stores keep products and storefronts you want to return to. Manage them from Wishlist and Saved stores.',
      },
      {
        id: 'seller-settings',
        title: 'Seller settings',
        body:
          'Sellers manage store-facing settings from Seller World and seller settings screens in the app.',
      },
      {
        id: 'preferences',
        title: 'App preferences',
        body:
          'Region, appearance, language, and related preferences live under Settings. Choose what matches how you shop or sell.',
      },
      {
        id: 'music',
        title: 'Music settings',
        body:
          'Where music is supported in the app, you can adjust it from Settings → Music.',
      },
    ],
  },
]