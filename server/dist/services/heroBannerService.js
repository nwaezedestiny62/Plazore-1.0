/**
 * Plazore Hero Banner personalization
 * Same behavioral foundation as Adaptive Showroom:
 * ShowroomEvent weights + recency decay. No LLM.
 */
import crypto from "crypto";
import Product from "../models/Products.js";
import ShowroomEvent from "../models/ShowroomEvent.js";
import HeroBanner from "../models/HeroBanner.js";
import PersonalizedBannerState from "../models/PersonalizedBannerState.js";
import User from "../models/User.js";
/** 30 minutes — stable until cycle ends or user returns after expiry */
export const BANNER_CYCLE_MS = 1000 * 60 * 30;
/** A couple of product opens (or one cart) can personalize */
const MIN_BEHAVIORAL_SCORE = 2.5;
const STATIC_FALLBACKS = {
    1: {
  imageUrl: "/hero/welcome.jpg",
  headline: "Let the shopping come to you.",
  subheadline: "Explore the Plazore Showroom — products, sellers, and discoveries worth seeing.",
  ctaLabel: "Explore the Showroom",
  kicker: "PLAZORE"
},
    4: {
        imageUrl: "/hero/new-arrivals.jpg",
        headline: "Just placed",
        subheadline: "New work on the floor. Same calm pace.",
        ctaLabel: "See what's new",
        kicker: "ARRIVALS",
    },
};
const ADMIN_DEFAULTS = {
    2: {
        imageUrl: "/hero/summer-poster.jpg",
        headline: "Light, considered",
        subheadline: "Warm tones and calm silhouettes for unhurried days.",
        ctaLabel: "Browse the edit",
        kicker: "SEASON",
    },
    3: {
        imageUrl: "/hero/featured-seller.jpg",
        headline: "Stores worth lingering in",
        subheadline: "Independent storefronts built with care.",
        ctaLabel: "Visit makers",
        kicker: "MAKERS",
    },
    5: {
        imageUrl: "/hero/christmas-poster.jpg",
        headline: "Chosen, not rushed",
        subheadline: "Thoughtful pieces for the people who matter.",
        ctaLabel: "Explore gifts",
        kicker: "GIFTS",
    },
};
function topKey(map) {
    let key = "";
    let score = 0;
    for (const [k, v] of map) {
        if (v > score) {
            key = k;
            score = v;
        }
    }
    return { key, score };
}
function topN(map, n = 3) {
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .filter(([, s]) => s > 0)
        .map(([k]) => k);
}
function firstNameOnly(raw) {
    if (!raw)
        return null;
    const part = String(raw).trim().split(/\s+/)[0] || "";
    if (part.length < 2 || part.length > 16)
        return null;
    return part.charAt(0).toUpperCase() + part.slice(1);
}
function softCat(category) {
    const c = String(category || "").trim();
    return c || "pieces";
}
async function buildInterestProfile(userId, sessionId) {
    const profile = {
        categories: new Map(),
        subCategories: new Map(),
        sellers: new Map(),
        totalWeight: 0,
    };
    const query = {};
    if (userId && sessionId) {
        query.$or = [{ sessionId }, { user: userId }];
    }
    else if (userId) {
        query.user = userId;
    }
    else if (sessionId) {
        query.sessionId = sessionId;
    }
    else {
        return profile;
    }
    const events = await ShowroomEvent.find(query)
        .sort({ createdAt: -1 })
        .limit(120)
        .populate("product", "category subCategory seller price")
        .lean();
    const now = Date.now();
    for (const ev of events) {
        const product = ev.product;
        if (!product)
            continue;
        const ageHours = (now - new Date(ev.createdAt).getTime()) / (1000 * 60 * 60);
        const decay = Math.exp(-ageHours / 72);
        let weight = 0;
        switch (ev.type) {
            case "purchase":
                weight = 12;
                break;
            case "cart":
                weight = 7;
                break;
            case "wishlist":
                weight = 5;
                break;
            case "open":
                weight = 3;
                break;
            case "impression":
                weight = 0.4;
                break;
            case "skip":
                weight = -2;
                break;
            default:
                weight = 0;
        }
        const w = weight * decay;
        if (!w)
            continue;
        const cat = String(product.category || "").trim();
        const sub = String(product.subCategory || "").trim();
        const seller = String(product.seller?._id || product.seller || "").trim();
        if (cat)
            profile.categories.set(cat, (profile.categories.get(cat) || 0) + w);
        if (sub)
            profile.subCategories.set(sub, (profile.subCategories.get(sub) || 0) + w);
        if (seller)
            profile.sellers.set(seller, (profile.sellers.get(seller) || 0) + w);
        if (w > 0)
            profile.totalWeight += w;
    }
    return profile;
}
/**
 * Global, calm, helpful Plazore voice.
 * No surveillance tone. No sales pressure. Optional first name only.
 */
function pickWording(category, firstName, position, intensity) {
    const cat = softCat(category);
    const name = firstNameOnly(firstName);

    // A name should feel like a welcome, not a personalization gimmick.
    const useName =
        !!name &&
        (intensity === "strong"
            ? crypto.randomInt(0, 10) < 5
            : intensity === "medium"
                ? crypto.randomInt(0, 10) < 4
                : crypto.randomInt(0, 10) < 5);

    const framesStrong = [
        {
            headline: useName ? `${name}, more to discover` : "More to discover",
            subheadline: `${cat} is finding its way to your Showroom.`,
            ctaLabel: "Explore",
            kicker: "FOR YOU",
            usedName: useName,
        },
        {
            headline: useName
                ? `${name}, your Showroom has more`
                : "Your Showroom has more",
            subheadline: `A closer look at ${cat}, presented for where your shopping is heading.`,
            ctaLabel: "Enter Showroom",
            kicker: cat.toUpperCase().slice(0, 18),
            usedName: useName,
        },
        {
            headline: `Keep exploring ${cat}`,
            subheadline: useName
                ? `${name}, more of what caught your attention is waiting on the floor.`
                : "More of what caught your attention is waiting on the floor.",
            ctaLabel: "Keep exploring",
            kicker: "SHOWROOM",
            usedName: useName,
        },
        {
            headline: useName
                ? `${name}, something worth seeing`
                : "Something worth seeing",
            subheadline: `${cat}, brought closer to your shopping journey.`,
            ctaLabel: "Discover",
            kicker: "PLAZORE",
            usedName: useName,
        },
    ];

    const framesMedium = [
        {
            headline: useName
                ? `${name}, explore ${cat}`
                : `Explore ${cat}`,
            subheadline: "The Showroom brings the next discovery closer.",
            ctaLabel: "Explore",
            kicker: "DISCOVERY",
            usedName: useName,
        },
        {
            headline: `More in ${cat}`,
            subheadline: useName
                ? `${name}, a new part of the Showroom is ready to explore.`
                : "A new part of the Showroom is ready to explore.",
            ctaLabel: "View Showroom",
            kicker: cat.toUpperCase().slice(0, 18),
            usedName: useName,
        },
        {
            headline: useName
                ? `For you, ${name}`
                : "Something for your journey",
            subheadline: `${cat} appearing closer to where your shopping is taking you.`,
            ctaLabel: "Explore",
            kicker: "SHOWROOM",
            usedName: useName,
        },
        {
            headline: `${cat} on the floor`,
            subheadline: "Look around. Discover something you didn't come searching for.",
            ctaLabel: "Step inside",
            kicker: "SHOWROOM",
            usedName: false,
        },
    ];

    const framesWeakNamed = name
        ? [
            {
                headline:
                    position === 1
                        ? `Welcome to Plazore, ${name}`
                        : `Welcome back, ${name}`,
                subheadline:
                    position === 1
                        ? "Let the shopping come to you."
                        : "There's more to discover across the Showroom.",
                ctaLabel:
                    position === 1
                        ? "Enter Showroom"
                        : "Explore Showroom",
                kicker: "PLAZORE",
                usedName: true,
            },
            {
                headline:
                    position === 1
                        ? `${name}, the Showroom is open`
                        : `${name}, something new is on the floor`,
                subheadline:
                    position === 1
                        ? "Products, sellers and discoveries — all waiting to be explored."
                        : "Take your time. The next discovery may already be here.",
                ctaLabel:
                    position === 1
                        ? "Enter Showroom"
                        : "Explore",
                kicker:
                    position === 1
                        ? "SHOWROOM"
                        : "NEW ON THE FLOOR",
                usedName: true,
            },
        ]
        : [];

    const framesWeak = [
        {
            headline:
                position === 1
                    ? "Let the shopping come to you."
                    : "New on the floor",
            subheadline:
                position === 1
                    ? "Welcome to the Plazore Showroom — a place to look around, discover, and shop."
                    : "Fresh products have arrived. Take a look around.",
            ctaLabel:
                position === 1
                    ? "Enter Showroom"
                    : "Explore",
            kicker:
                position === 1
                    ? "PLAZORE"
                    : "NEW ON THE FLOOR",
            usedName: false,
        },
        {
            headline:
                position === 1
                    ? "Shop beyond the search."
                    : "Something new to discover",
            subheadline:
                position === 1
                    ? "You don't always need to know what you're looking for. Start exploring."
                    : "The Showroom brings new possibilities closer to you.",
            ctaLabel:
                position === 1
                    ? "Explore Showroom"
                    : "Discover",
            kicker:
                position === 1
                    ? "SHOWROOM"
                    : "DISCOVERY",
            usedName: false,
        },
        {
            headline:
                position === 1
                    ? "Welcome to the Digital Mall"
                    : "Fresh on the floor",
            subheadline:
                position === 1
                    ? "Explore products, sellers and discoveries — all in one place."
                    : "Newly listed products, ready whenever you are.",
            ctaLabel:
                position === 1
                    ? "Enter Showroom"
                    : "View arrivals",
            kicker:
                position === 1
                    ? "PLAZORE SHOWROOM"
                    : "NEW ARRIVALS",
            usedName: false,
        },
        {
            headline:
                position === 1
                    ? "There's more to discover."
                    : "Keep looking around.",
            subheadline:
                position === 1
                    ? "The Showroom is built for the things you didn't know you wanted to see."
                    : "You might find your next purchase somewhere you weren't expecting.",
            ctaLabel:
                position === 1
                    ? "Start exploring"
                    : "Explore",
            kicker:
                position === 1
                    ? "DISCOVERY"
                    : "SHOWROOM",
            usedName: false,
        },
        ...framesWeakNamed,
    ];

    const pool =
        intensity === "strong"
            ? framesStrong
            : intensity === "medium"
                ? framesMedium
                : framesWeak;

    return pool[crypto.randomInt(0, pool.length)];
}

async function pickVisual(category, region) {
    if (category) {
        const esc = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const product = await Product.findOne({
            isActive: true,
            category: { $regex: `^${esc}$`, $options: "i" },
            ...(region ? { region: { $regex: region, $options: "i" } } : {}),
            "images.0": { $exists: true },
        })
            .sort({ updatedAt: -1 })
            .select("images")
            .lean();
        if (product?.images?.[0]) {
            return {
                imageUrl: String(product.images[0]),
                productId: String(product._id),
                visualSource: "product_image",
            };
        }
        const any = await Product.findOne({
            isActive: true,
            category: { $regex: `^${esc}$`, $options: "i" },
            "images.0": { $exists: true },
        })
            .sort({ updatedAt: -1 })
            .select("images")
            .lean();
        if (any?.images?.[0]) {
            return {
                imageUrl: String(any.images[0]),
                productId: String(any._id),
                visualSource: "product_image",
            };
        }
    }
    return {
        imageUrl: "",
        productId: null,
        visualSource: "static_hero",
    };
}
function intensityFromScore(score) {
    if (score >= 12)
        return "strong";
    if (score >= MIN_BEHAVIORAL_SCORE)
        return "medium";
    return "weak";
}
async function generatePersonalizedCreative(opts) {
    const { position, userId, sessionId, region, firstName } = opts;
    const profile = await buildInterestProfile(userId, sessionId);
    const topCat = topKey(profile.categories);
    const topSub = topKey(profile.subCategories);
    const intensity = intensityFromScore(topCat.score);
    const mode = topCat.score >= MIN_BEHAVIORAL_SCORE && topCat.key
        ? "behavioral"
        : "cold_start";
    const fallback = STATIC_FALLBACKS[position];
    let wording;
    let imageUrl = fallback.imageUrl;
    let productId = null;
    let visualSource = "static_hero";
    let primarySignal = "Limited behavioral data — using marketplace discovery logic.";
    let supporting = [];
    let categoryContext = "";
    let subCategoryContext = "";
    if (mode === "behavioral") {
        categoryContext = topCat.key;
        subCategoryContext = topSub.key || "";
        const visual = await pickVisual(topCat.key, region);
        if (visual.imageUrl) {
            imageUrl = visual.imageUrl;
            productId = visual.productId;
            visualSource = visual.visualSource;
        }
        wording = pickWording(topCat.key, firstName, position, intensity);
        primarySignal =
            intensity === "strong"
                ? `Strong recent engagement with ${topCat.key}.`
                : `Repeated exploration of ${topCat.key}.`;
        supporting = topN(profile.categories, 3)
            .filter((c) => c !== topCat.key)
            .map((c) => `Also active in ${c}`);
        if (topSub.key)
            supporting.unshift(`Sub-focus: ${topSub.key}`);
    }
    else {
        wording = pickWording("", firstName, position, "weak");
    }
    const now = new Date();
    const cycleId = crypto.randomBytes(8).toString("hex");
    return {
        imageUrl,
        headline: wording.headline,
        subheadline: wording.subheadline,
        ctaLabel: wording.ctaLabel,
        ctaAction: categoryContext ? "category" : "scroll_showroom",
        ctaTarget: categoryContext || "",
        kicker: wording.kicker,
        usedName: wording.usedName,
        mode,
        primarySignal,
        supportingSignals: supporting.slice(0, 4),
        categoryContext,
        subCategoryContext,
        visualSource,
        productId,
        signalScore: Math.round(topCat.score * 10) / 10,
        cycleId,
        generatedAt: now,
        expiresAt: new Date(now.getTime() + BANNER_CYCLE_MS),
    };
}
export async function ensureHeroSlots() {
    const specs = [
        { position: 1, controlType: "system", label: "Banner 1 — Personalized" },
        { position: 2, controlType: "admin", label: "Banner 2 — Admin Controlled" },
        { position: 3, controlType: "admin", label: "Banner 3 — Admin Controlled" },
        { position: 4, controlType: "system", label: "Banner 4 — Personalized" },
        { position: 5, controlType: "admin", label: "Banner 5 — Admin Controlled" },
    ];
    for (const s of specs) {
        const existing = await HeroBanner.findOne({ position: s.position });
        if (existing)
            continue;
        const def = s.controlType === "admin"
            ? ADMIN_DEFAULTS[s.position]
            : STATIC_FALLBACKS[s.position];
        const creative = {
            imageUrl: def?.imageUrl || "/hero/welcome.jpg",
            headline: def?.headline || "Plazore",
            subheadline: def?.subheadline || "",
            ctaLabel: def?.ctaLabel || "Explore",
            ctaAction: "scroll_showroom",
            ctaTarget: "",
            kicker: def?.kicker || "",
        };
        await HeroBanner.create({
            position: s.position,
            controlType: s.controlType,
            label: s.label,
            isActive: true,
            published: s.controlType === "admin" ? creative : {},
            publishedVersion: s.controlType === "admin" ? 1 : 0,
            draft: creative,
            history: s.controlType === "admin"
                ? [
                    {
                        version: 1,
                        creative,
                        status: "published",
                        publishedAt: new Date(),
                        note: "Seeded from default campaign assets",
                    },
                ]
                : [],
        });
    }
}
export async function resolvePersonalizedSlot(opts) {
    const position = opts.position;
    const userId = opts.userId || null;
    const sessionId = String(opts.sessionId || "").trim();
    const region = String(opts.region || "NG").toUpperCase();
    const force = Boolean(opts.forceRefresh);
    let firstName = null;
    if (userId) {
        const u = await User.findById(userId).select("name").lean();
        firstName = u?.name || null;
    }
    const filter = { position };
    if (userId)
        filter.user = userId;
    else
        filter.sessionId = sessionId || "anon";
    let state = await PersonalizedBannerState.findOne(filter).lean();
    const stillValid = state &&
        state.expiresAt &&
        new Date(state.expiresAt).getTime() > Date.now() &&
        !force;
    if (stillValid) {
        const isCold = state.mode === "cold_start" ||
            state.mode === "weak" ||
            !state.mode;
        if (isCold) {
            const probe = await buildInterestProfile(userId, sessionId || "anon");
            const top = topKey(probe.categories);
            if (!(top.score >= MIN_BEHAVIORAL_SCORE && top.key)) {
                return {
                    ...state,
                    reuse: true,
                    nextRefreshAt: state.expiresAt,
                };
            }
        }
        else {
            return {
                ...state,
                reuse: true,
                nextRefreshAt: state.expiresAt,
            };
        }
    }
    const generated = await generatePersonalizedCreative({
        position,
        userId,
        sessionId: sessionId || "anon",
        region,
        firstName,
    });
    const payload = {
        user: userId,
        sessionId: userId ? "" : sessionId || "anon",
        position,
        region,
        ...generated,
        productId: generated.productId || null,
    };
    state = await PersonalizedBannerState.findOneAndUpdate(filter, { $set: payload }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }).lean();
    return {
        ...state,
        reuse: false,
        nextRefreshAt: generated.expiresAt,
    };
}
export async function resolvePublicHero(opts) {
    await ensureHeroSlots();
    const slots = await HeroBanner.find({}).sort({ position: 1 }).lean();
    const banners = [];
    for (const slot of slots) {
        if (slot.controlType === "system") {
            const pers = await resolvePersonalizedSlot({
                position: slot.position,
                userId: opts.userId,
                sessionId: opts.sessionId,
                region: opts.region,
                forceRefresh: opts.forceRefresh,
            });
            banners.push({
                position: slot.position,
                controlType: "system",
                isActive: slot.isActive !== false,
                imageUrl: pers.imageUrl,
                headline: pers.headline,
                subheadline: pers.subheadline,
                ctaLabel: pers.ctaLabel,
                ctaAction: pers.ctaAction,
                ctaTarget: pers.ctaTarget,
                kicker: pers.kicker,
                diagnostics: {
                    mode: pers.mode,
                    primarySignal: pers.primarySignal,
                    supportingSignals: pers.supportingSignals,
                    categoryContext: pers.categoryContext,
                    generatedAt: pers.generatedAt,
                    expiresAt: pers.expiresAt,
                    cycleId: pers.cycleId,
                    visualSource: pers.visualSource,
                    usedName: pers.usedName,
                    signalScore: pers.signalScore,
                },
            });
        }
        else {
            const c = slot.published || {};
            banners.push({
                position: slot.position,
                controlType: "admin",
                isActive: slot.isActive !== false,
                imageUrl: c.imageUrl || "",
                headline: c.headline || "",
                subheadline: c.subheadline || "",
                ctaLabel: c.ctaLabel || "Explore",
                ctaAction: c.ctaAction || "scroll_showroom",
                ctaTarget: c.ctaTarget || "",
                kicker: c.kicker || "",
                publishedVersion: slot.publishedVersion || 0,
                updatedAt: slot.updatedAt,
            });
        }
    }
    return banners.sort((a, b) => a.position - b.position);
}
