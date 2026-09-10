"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronLeft,
  HelpCircle,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react";

type HelpArticle = { id: string; title: string; body: string };
type HelpCategory = {
  id: string;
  title: string;
  intro?: string;
  articles: HelpArticle[];
};

const HELP_QUICK = [
  {
    id: "track",
    title: "Track an order",
    subtitle: "See where your order is and what happens next.",
    href: "/orders",
    icon: Package,
  },
  {
    id: "contact",
    title: "Contact Plazore",
    subtitle: "Orders, payments, account, store, or something else.",
    href: "/contact",
    icon: MessageCircle,
  },
  {
    id: "shopping",
    title: "Shopping help",
    subtitle: "Browse, cart, checkout, and purchases.",
    categoryId: "shopping",
    icon: ShoppingBag,
  },
  {
    id: "selling",
    title: "Selling help",
    subtitle: "Stores, products, orders, and seller tools.",
    categoryId: "selling",
    icon: Store,
  },
] as const;

const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "how-it-works",
    title: "How Plazore Works",
    intro:
      "Plazore is a discovery-first marketplace. You can browse, understand a product, pay, track, and confirm — all in one flow.",
    articles: [
      {
        id: "discover",
        title: "Discover",
        body: "Browse the Plazore showroom or search for something specific. Plazore is built for both intentional shopping and discovering products you may not have been looking for yet.",
      },
      {
        id: "explore-product",
        title: "Explore a product",
        body: "Open a product to view its information, seller, availability, images, and other relevant details before you decide.",
      },
      {
        id: "understand",
        title: "Understand before you buy",
        body: "Where enough information is available, Plazore AI and Buyer Confidence help you understand a product faster. They support your decision — they do not make the purchase for you.",
      },
      {
        id: "add-cart",
        title: "Add to cart",
        body: "Choose the product and any available options, select your quantity, and add it to your cart.",
      },
      {
        id: "checkout",
        title: "Checkout",
        body: "Review your order, delivery information, and total before continuing to payment.",
      },
      {
        id: "pay",
        title: "Pay",
        body: "Complete payment through Plazore’s supported payment system. Do not pay sellers separately outside checkout.",
      },
      {
        id: "track",
        title: "Track",
        body: "Follow your order through processing, shipping, and delivery from your Orders section.",
      },
      {
        id: "confirm",
        title: "Confirm",
        body: "After the seller marks the order as delivered, you can confirm that you received it or raise an issue if something is wrong.",
      },
    ],
  },
  {
    id: "shopping",
    title: "Shopping on Plazore",
    articles: [
      {
        id: "find-products",
        title: "How do I find products?",
        body: "Search when you know what you want, or browse the showroom to discover products naturally.",
      },
      {
        id: "showroom",
        title: "How does the showroom work?",
        body: "The showroom organizes available products using relevance, availability, marketplace activity, discovery signals, and how you interact with Plazore. It helps you discover without needing to know exactly what you want first.",
      },
      {
        id: "search-vs-browse",
        title: "Can I search instead of browse?",
        body: "Yes. Plazore supports both. Search for something specific; explore when you want to discover something new.",
      },
      {
        id: "add-to-cart",
        title: "How do I add something to my cart?",
        body: "Open the product, choose any required options, select your quantity, and select Add to Cart.",
      },
      {
        id: "change-cart",
        title: "Can I change my cart?",
        body: "Yes. Review your cart, change quantities or available options, remove products, and check the order before checkout.",
      },
      {
        id: "cart-notes",
        title: "What are cart notes?",
        body: "Where supported, cart notes let you add clear information useful for fulfilment or delivery. Keep them relevant.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    articles: [
      {
        id: "how-pay",
        title: "How do I pay?",
        body: "At checkout, review your order and continue with the payment method provided by Plazore.",
      },
      {
        id: "who-handles",
        title: "Is my payment handled by Plazore?",
        body: "Plazore manages the commerce and order experience. Supported payment infrastructure processes the transaction itself.",
      },
      {
        id: "after-pay",
        title: "What happens after I pay?",
        body: "Your order is created and moves through Plazore’s order process. Track status anytime in Orders.",
      },
      {
        id: "pay-problem",
        title: "What if my payment has a problem?",
        body: "Do not pay the seller outside Plazore checkout. If payment or the order has a problem, use Contact Plazore and include the relevant order details.",
      },
    ],
  },
  {
    id: "orders",
    title: "Orders & Delivery",
    intro: "Orders move through clear stages so you always know where things stand.",
    articles: [
      {
        id: "paid",
        title: "Paid",
        body: "Your payment was processed successfully and the order has been created on Plazore.",
      },
      {
        id: "processing",
        title: "Processing",
        body: "The seller is preparing your order for dispatch.",
      },
      {
        id: "shipped",
        title: "Shipped",
        body: "Your order has been dispatched for delivery.",
      },
      {
        id: "delivered",
        title: "Delivered",
        body: "The seller has marked your order as delivered.",
      },
      {
        id: "confirm-delivery",
        title: "Confirm delivery",
        body: "If you received the order and everything is correct, confirm delivery. That helps complete the commerce cycle for both you and the seller.",
      },
      {
        id: "order-issues",
        title: "What if something is wrong?",
        body: "If you did not receive the order or something is wrong, use the issue option and Contact Plazore with the order context. Examples include not received, marked delivered incorrectly, wrong or damaged product, missing item, or a delivery problem.",
      },
    ],
  },
  {
    id: "protection",
    title: "Buyer Protection",
    intro:
      "Plazore is designed to give buyers a structured commerce experience instead of leaving every transaction to an informal chat with a seller.",
    articles: [
      {
        id: "how-protect",
        title: "How does Plazore support buyers?",
        body: "Orders are recorded in Plazore. Payment goes through supported payment infrastructure. Delivery status is tracked. You can confirm delivery or raise an issue. When needed, Plazore can review relevant order, seller, product, payment, and delivery information.",
      },
      {
        id: "if-wrong",
        title: "If something goes wrong",
        body: "Contact Plazore rather than arranging payment or resolution outside the platform. Issues may include: order not received, marked delivered but not received, wrong product, damaged product, missing item, delivery problems, or other concerns. Resolution depends on the facts of each case — Plazore does not guarantee an automatic refund for every issue.",
      },
    ],
  },
  {
    id: "selling",
    title: "Selling on Plazore",
    articles: [
      {
        id: "become-seller",
        title: "How do I become a seller?",
        body: "Create or activate your seller presence through the available seller setup and complete the required information.",
      },
      {
        id: "add-product",
        title: "How do I add a product?",
        body: "Create a listing with accurate product information, permitted images, price, and availability, then publish when ready.",
      },
      {
        id: "seller-orders",
        title: "How do orders work for sellers?",
        body: "When a buyer purchases your product, the order appears in your seller order area. Fulfil it and update the order through the available stages.",
      },
      {
        id: "payouts",
        title: "How do seller payouts work?",
        body: "Payout eligibility is connected to order completion and Plazore’s payout process. Marking an order as delivered does not by itself mean the transaction is immediately completed or paid out.",
      },
      {
        id: "product-info",
        title: "Why does product information matter?",
        body: "Accurate details help buyers understand what they are purchasing and give Plazore better information for discovery and product intelligence.",
      },
    ],
  },
  {
    id: "seller-world",
    title: "Seller World",
    intro:
      "Seller World is the seller’s business environment inside Plazore — store, products, orders, activity, and related tools in one place.",
    articles: [
      {
        id: "manage-store",
        title: "Managing my store",
        body: "Use Seller World to keep store details, visibility, and business settings accurate so buyers can find and trust your storefront.",
      },
      {
        id: "manage-products",
        title: "Managing products",
        body: "Add, edit, activate, or retire listings. Keep stock, pricing, and product details up to date.",
      },
      {
        id: "manage-orders-sw",
        title: "Managing orders",
        body: "Process new orders, update fulfilment stages, and respond to buyer messages tied to your products.",
      },
      {
        id: "store-activity",
        title: "Understanding store activity",
        body: "Seller tools surface commerce activity around your products and orders so you can see what is moving and what needs attention.",
      },
      {
        id: "visibility",
        title: "Seller visibility",
        body: "Clear product information, active listings, and healthy order handling help your store and products be discovered in the showroom and search.",
      },
      {
        id: "plans",
        title: "Seller plans",
        body: "Where plans are available, they relate to how you operate as a seller on Plazore. Review plan details inside Seller World before changing anything.",
      },
      {
        id: "seller-payouts-sw",
        title: "Seller payouts",
        body: "Payouts follow Plazore’s completion and eligibility rules. Check seller order and payout status in your storefront tools rather than assuming immediate payment after marking delivered.",
      },
    ],
  },
  {
    id: "ai",
    title: "Plazore AI",
    intro: "Plazore AI is built for product and commerce intelligence — not generic chat.",
    articles: [
      {
        id: "what-ai",
        title: "What is Plazore AI?",
        body: "Plazore AI turns available product information and marketplace activity into useful context so buyers can understand products faster and sellers can better understand their commerce activity.",
      },
      {
        id: "ai-decide",
        title: "Does Plazore AI choose what I buy?",
        body: "No. It supports your decision. You remain responsible for what you purchase.",
      },
      {
        id: "buyer-confidence",
        title: "What is Buyer Confidence?",
        body: "Buyer Confidence indicates how much useful supporting information and marketplace activity is available for a product. It is context, not a star rating or a guarantee. States may include High Confidence, Growing, or Limited. Limited does not mean a product is bad — it can simply mean there is not enough supporting information or activity yet.",
      },
      {
        id: "ai-sellers",
        title: "How does Plazore AI help sellers?",
        body: "It can help sellers understand product and commerce activity, notice meaningful changes, and turn marketplace information into clearer business context.",
      },
    ],
  },
  {
    id: "discovery",
    title: "Discovery",
    articles: [
      {
        id: "how-discovery",
        title: "How does discovery work?",
        body: "Plazore’s discovery system uses marketplace and interaction signals to improve what products are surfaced over time. Signals can include product views, clicks, time spent, category activity, searches, add-to-cart, checkout, purchases, store visits, and other available commerce signals.",
      },
      {
        id: "signal-weight",
        title: "Does one click change everything?",
        body: "No. A single click does not rewrite your whole experience. Stronger signals such as purchases, checkout, and add-to-cart can carry more weight than light browsing.",
      },
      {
        id: "not-only-ai",
        title: "Is the showroom only AI?",
        body: "No. The showroom combines marketplace fundamentals with discovery and personalization signals. It is not claimed to be powered only by AI.",
      },
    ],
  },
  {
    id: "banners",
    title: "Plazore Banners",
    articles: [
      {
        id: "banner-types",
        title: "What are Plazore banners?",
        body: "Some banners are personalized using marketplace and interaction signals. Others are controlled by Plazore administration for platform messaging, campaigns, and marketplace communication.",
      },
      {
        id: "banner-cycle",
        title: "How often do personalized banners update?",
        body: "Personalized banners refresh according to Plazore’s defined personalization cycle — not on every single click.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Settings",
    articles: [
      {
        id: "manage-account",
        title: "Managing my account",
        body: "Open Profile and Settings to review account details and how you use Plazore.",
      },
      {
        id: "profile",
        title: "Updating my profile",
        body: "Update your profile information from Profile or Settings so your account stays accurate.",
      },
      {
        id: "notifications",
        title: "Notifications",
        body: "Order, chat, and platform notices appear in Notifications. Review preferences under Settings where available.",
      },
      {
        id: "privacy",
        title: "Privacy",
        body: "Review privacy-related options in Settings. Contact Plazore if you need help with an account privacy concern.",
      },
      {
        id: "saved",
        title: "Saved items",
        body: "Wishlist and saved stores keep products and storefronts you want to return to.",
      },
      {
        id: "seller-settings",
        title: "Seller settings",
        body: "Sellers manage store-facing settings from Seller World and seller settings.",
      },
      {
        id: "preferences",
        title: "App preferences",
        body: "Region, appearance, language, and related preferences live under Settings.",
      },
    ],
  },
];

function matches(cat: HelpCategory, a: HelpArticle, q: string) {
  if (!q) return true;
  return `${cat.title} ${cat.intro || ""} ${a.title} ${a.body}`.toLowerCase().includes(q);
}

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openArticle, setOpenArticle] = useState<string | null>(null);
  const [helpful, setHelpful] = useState<Record<string, "yes" | "no">>({});

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return HELP_CATEGORIES;
    return HELP_CATEGORIES.map((c) => ({
      ...c,
      articles: c.articles.filter((a) => matches(c, a, q)),
    })).filter(
      (c) => c.articles.length > 0 || (c.intro && c.intro.toLowerCase().includes(q)),
    );
  }, [q]);

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/lounge"
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.07] bg-[#11141A] text-[#F5F7FA] transition hover:border-[#00E575]/40"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
                    <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Plazore"
                width={28}
                height={28}
                className="object-contain"
              />
              <p className="text-[10px] font-bold tracking-[1.8px] text-[#00E575]">SUPPORT</p>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Help</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#A7ADB8] sm:text-sm">
              Everything you need to shop, sell, and understand Plazore.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex items-center gap-3 border border-white/[0.07] bg-[#11141A] px-4 py-3 focus-within:border-[#00E575]/40">
          <Search className={`h-4 w-4 shrink-0 ${q ? "text-[#00E575]" : "text-[#6B7280]"}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Help"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#6B7280]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs font-semibold text-[#6B7280] hover:text-[#F5F7FA]"
            >
              Clear
            </button>
          ) : null}
        </div>

        {!q ? (
          <section className="mb-10">
            <p className="mb-4 text-[10px] font-bold tracking-[1.6px] text-[#6B7280]">
              QUICK HELP
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {HELP_QUICK.map((item) => {
                const Icon = item.icon;
                const inner = (
                  <>
                    <div className="mb-3 flex h-9 w-9 items-center justify-center bg-[#00E575]/10">
                      <Icon className="h-4 w-4 text-[#00E575]" />
                    </div>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="mt-1 text-xs leading-4 text-[#6B7280]">{item.subtitle}</p>
                  </>
                );
                if ("href" in item && item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="border border-white/[0.07] bg-[#11141A] p-4 transition hover:border-[#00E575]/30"
                    >
                      {inner}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpenCat(item.categoryId || null);
                      setOpenArticle(null);
                    }}
                    className="border border-white/[0.07] bg-[#11141A] p-4 text-left transition hover:border-[#00E575]/30"
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section>
          <p className="mb-4 text-[10px] font-bold tracking-[1.6px] text-[#6B7280]">
            {q
              ? `RESULTS · ${filtered.reduce((n, c) => n + c.articles.length, 0)}`
              : "TOPICS"}
          </p>

          {filtered.length === 0 ? (
            <div className="border border-white/[0.07] bg-[#11141A] px-6 py-16 text-center">
              <HelpCircle className="mx-auto h-8 w-8 text-[#6B7280]" />
              <p className="mt-3 text-base font-bold">No matching help</p>
              <p className="mt-2 text-sm text-[#A7ADB8]">
                Try another phrase, or contact Plazore with your question.
              </p>
              <Link
                href="/contact"
                className="mt-5 inline-flex border border-white/[0.07] bg-[#171B22] px-4 py-2 text-sm font-bold text-[#00E575]"
              >
                Contact Plazore
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((cat) => {
                const expanded = openCat === cat.id || !!q;
                return (
                  <div
                    key={cat.id}
                    className="border border-white/[0.07] bg-[#11141A]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCat((p) => (p === cat.id ? null : cat.id));
                        setOpenArticle(null);
                      }}
                      className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left sm:px-5"
                    >
                      <div>
                        <p className="text-[15px] font-bold">{cat.title}</p>
                        {expanded && cat.intro ? (
                          <p className="mt-2 text-[13px] leading-5 text-[#A7ADB8]">
                            {cat.intro}
                          </p>
                        ) : null}
                      </div>
                      <ChevronDown
                        className={`mt-1 h-4 w-4 shrink-0 text-[#6B7280] transition ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {expanded ? (
                      <div className="border-t border-white/[0.07]">
                        {cat.articles.map((article) => {
                          const open =
                            openArticle === article.id ||
                            (!!q && cat.articles.length <= 3);
                          return (
                            <div
                              key={article.id}
                              className="border-t border-white/[0.05] first:border-t-0"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenArticle((p) =>
                                    p === article.id ? null : article.id,
                                  )
                                }
                                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
                              >
                                <span className="text-sm font-semibold">{article.title}</span>
                                <span className="text-[#00E575]">{open ? "−" : "+"}</span>
                              </button>
                              {open ? (
                                <div className="px-4 pb-4 sm:px-5">
                                  <p className="text-[13.5px] leading-5 text-[#A7ADB8]">
                                    {article.body}
                                  </p>
                                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-[#6B7280]">
                                      Was this helpful?
                                    </p>
                                    <div className="flex gap-2">
                                      {(["yes", "no"] as const).map((val) => (
                                        <button
                                          key={val}
                                          type="button"
                                          onClick={() => {
                                            setHelpful((h) => ({
                                              ...h,
                                              [article.id]: val,
                                            }));
                                          }}
                                          className={`border px-3 py-1 text-xs font-bold ${
                                            helpful[article.id] === val
                                              ? "border-[#00E575]/45 bg-[#00E575]/10 text-[#00E575]"
                                              : "border-white/[0.07] bg-[#171B22] text-[#A7ADB8]"
                                          }`}
                                        >
                                          {val === "yes" ? "Yes" : "No"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  {helpful[article.id] === "no" ? (
                                    <p className="mt-2 text-xs text-[#6B7280]">
                                      Tell us what was missing —{" "}
                                      <Link
                                        href="/contact?topic=Help%20feedback"
                                        className="font-semibold text-[#00E575]"
                                      >
                                        Contact Plazore
                                      </Link>
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-12 border border-[#00E575]/20 bg-gradient-to-br from-[#00E575]/10 to-[#3B82F6]/10 p-6 sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">
            Still need help?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A7ADB8]">
            We’re here for Plazore. Tell us what happened and give enough detail — orders,
            payments, account, store, or something else.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-[#00E575] to-[#3B82F6] px-5 py-2.5 text-sm font-extrabold text-[#090B0F]"
          >
            <MessageCircle className="h-4 w-4" />
            Contact Plazore
          </Link>
        </section>
      </main>
    </div>
  );
}