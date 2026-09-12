import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

const EASE = Easing.bezier(0.22, 1, 0.36, 1)
const LOGO = require('../../assets/logo-4.png')

const AUTOPILOT = [
  'ACTIVITY',
  'OBSERVATION',
  'UNDERSTANDING',
  'ACTION',
  'IMPROVEMENT',
  'ACTIVITY',
]
const COMMERCE_FLOW = [
  'DISCOVER',
  'EXPLORE',
  'PRODUCT',
  'CART',
  'CHECKOUT',
  'PAYMENT',
  'ORDER',
  'DELIVERY',
  'CONFIRM',
  'COMPLETE',
]
const TRUST_FLOW = [
  'Payment',
  'Order',
  'Fulfilment',
  'Delivery',
  'Buyer Confirmation',
  'Completion',
]
const ISSUE_FLOW = ['Issue', 'Plazore Contact', 'Review', 'Resolution']

function FadeIn({
  children,
  delay = 0,
  y = 18,
  reduceMotion,
  visible,
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  reduceMotion: boolean
  visible: boolean
}) {
  const anim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1)
      return
    }
    if (!visible) return
    Animated.timing(anim, {
      toValue: 1,
      duration: 520,
      delay,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [visible, reduceMotion, delay, anim])

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [y, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

function Body({ children }: { children: string }) {
  return <Text style={styles.body}>{children}</Text>
}

function Quote({ children }: { children: string }) {
  return (
    <View style={styles.quoteWrap}>
      <View style={styles.quoteBar} />
      <Text style={styles.quote}>{children}</Text>
    </View>
  )
}

function Card({
  title,
  body,
  icon,
}: {
  title: string
  body: string
  icon?: keyof typeof Ionicons.glyphMap
}) {
  return (
    <View style={styles.card}>
      {icon ? (
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={18} color={GREEN} />
        </View>
      ) : null}
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  )
}

function FlowColumn({ steps }: { steps: string[] }) {
  return (
    <View style={styles.flowCol}>
      {steps.map((step, i) => (
        <View key={`${step}-${i}`} style={styles.flowStep}>
          <View style={styles.flowDot} />
          <Text style={styles.flowText}>{step}</Text>
          {i < steps.length - 1 ? <View style={styles.flowLine} /> : null}
        </View>
      ))}
    </View>
  )
}

function FlowRow({ steps }: { steps: string[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.flowRow}
    >
      {steps.map((step, i) => (
        <View key={`${step}-${i}`} style={styles.flowRowItem}>
          <Text style={styles.flowRowText}>{step}</Text>
          {i < steps.length - 1 ? (
            <Ionicons
              name="arrow-forward"
              size={12}
              color={MUTED}
              style={{ marginHorizontal: 6 }}
            />
          ) : null}
        </View>
      ))}
    </ScrollView>
  )
}

export default function AboutPlazore() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  const [reduceMotion, setReduceMotion] = useState(false)
  const [seen, setSeen] = useState<Record<string, boolean>>({ hero: true })

  const heroLogo = useRef(new Animated.Value(0)).current
  const heroTitle = useRef(new Animated.Value(0)).current
  const heroSub = useRef(new Animated.Value(0)).current

  const version =
    Constants.expoConfig?.version || Constants.nativeAppVersion || '1.0.0'

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      heroLogo.setValue(1)
      heroTitle.setValue(1)
      heroSub.setValue(1)
      return
    }
    Animated.stagger(160, [
      Animated.timing(heroLogo, {
        toValue: 1,
        duration: 700,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(heroTitle, {
        toValue: 1,
        duration: 620,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(heroSub, {
        toValue: 1,
        duration: 620,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start()
  }, [reduceMotion, heroLogo, heroTitle, heroSub])

  const mark = useCallback((id: string) => {
    setSeen((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
  }, [])

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y
      const trigger = y + winH * 0.82
      const thresholds: [string, number][] = [
        ['s1', 280],
        ['s2', 620],
        ['s3', 1000],
        ['s4', 1500],
        ['s5', 1900],
        ['s6', 2300],
        ['s7', 2700],
        ['s8', 3100],
        ['s9', 3500],
        ['s10', 3900],
        ['s11', 4300],
        ['s12', 4700],
        ['s13', 5100],
        ['s14', 5600],
        ['s15', 6000],
      ]
      thresholds.forEach(([id, t]) => {
        if (trigger >= t) mark(id)
      })
    },
    [winH, mark],
  )

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/settings' as any)
  }

  const v = (id: string) => !!seen[id] || reduceMotion

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.topTitle}>About Plazore</Text>
        <Text style={styles.topVer}>v{version}</Text>
      </View>

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={48}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        <View style={styles.hero}>
          <Animated.View
            style={{
              opacity: heroLogo,
              transform: [
                {
                  translateY: heroLogo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            }}
          >
                        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </Animated.View>
          <Animated.Text style={[styles.tagline, { opacity: heroTitle }]}>
            The New Way to Shop and Earn.
          </Animated.Text>
          <Animated.Text style={[styles.heroBody, { opacity: heroSub }]}>
            Plazore is a digital commerce platform built to make discovering, buying,
            selling, and understanding commerce feel fundamentally different.
          </Animated.Text>
        </View>

        <FadeIn visible={v('s1')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>WHAT IS PLAZORE</SectionLabel>
            <SectionTitle>Commerce, Reimagined.</SectionTitle>
            <Body>
              Plazore is a modern digital marketplace designed around a simple idea:
              commerce does not have to feel the same forever.
            </Body>
            <Body>
              People should be able to discover products naturally, search when they know
              what they want, understand what they are considering, buy with confidence,
              track what happens after checkout, and return to a marketplace that becomes
              more useful through real commerce activity.
            </Body>
            <Body>
              For sellers, Plazore is more than a place to upload products. It is a digital
              environment for establishing a store, reaching buyers, managing commerce,
              understanding business activity, and growing with less unnecessary
              operational friction.
            </Body>
            <Text style={styles.emphasis}>
              Familiar commerce fundamentals. A different experience.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s2')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>WHY WE EXIST</SectionLabel>
            <SectionTitle>Why We Built Plazore</SectionTitle>
            <Body>
              Commerce has existed for as long as people have exchanged value. The tools
              around it have changed countless times, but many of the habits remain
              familiar.
            </Body>
            <Text style={styles.monoLine}>
              Search. Browse. Compare. Buy. Sell. Deliver. Get paid. Repeat.
            </Text>
            <Body>Plazore asks a different question:</Body>
            <Quote>What if more of commerce could simply run?</Quote>
            <Body>
              What if a business did not have to spend so much of its time manually
              figuring out what was already happening inside its own commerce?
            </Body>
            <Body>
              What if products could become easier to discover from actual marketplace
              activity? What if sellers could understand where their business is
              improving, where it is slowing down, and where attention may be needed —
              without piecing everything together themselves?
            </Body>
            <Body>
              What if buyers could understand products faster and have a structured
              commerce system behind their purchases?
            </Body>
            <Text style={styles.emphasis}>Plazore is built around that pursuit.</Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s3')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>AUTOPILOT</SectionLabel>
            <SectionTitle>Commerce on Autopilot.</SectionTitle>
            <Text style={styles.subtitle}>Less guesswork. More intelligent systems.</Text>
            <Body>
              Plazore is pursuing a future where commerce can increasingly operate on
              autopilot — not because humans no longer matter, but because people should
              not spend their time repeatedly performing tasks that software can observe,
              organize, measure, and coordinate.
            </Body>
            <FlowColumn steps={AUTOPILOT} />
            <Body>
              People browse. People buy. Products perform differently. Demand changes.
              Problems appear. Businesses grow or slow down. Plazore continuously turns
              those signals into useful commerce intelligence and structured workflows.
            </Body>
            <Body>The goal is not to remove the human from commerce.</Body>
            <Quote>The goal is to remove unnecessary human effort from commerce.</Quote>
          </View>
        </FadeIn>

        <FadeIn visible={v('s4')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>BUYERS</SectionLabel>
            <SectionTitle>For People Who Shop</SectionTitle>
            <Body>
              Plazore gives buyers two ways to experience commerce: discover naturally or
              search intentionally.
            </Body>
            <Card
              icon="compass-outline"
              title="Discover"
              body="Explore products through the Plazore showroom and encounter things you may not have known you were looking for."
            />
            <Card
              icon="bulb-outline"
              title="Understand"
              body="Use product information and Plazore AI to understand what you are considering more quickly."
            />
            <Card
              icon="bag-handle-outline"
              title="Buy"
              body="Add products to your cart, review your order, pay through supported payment infrastructure, track delivery, confirm receipt, and raise an issue through Plazore when something goes wrong."
            />
            <Text style={styles.emphasis}>
              Shopping should not begin with knowing exactly what you want. Sometimes
              discovery comes first.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s5')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>SELLERS</SectionLabel>
            <SectionTitle>For People Who Sell</SectionTitle>
            <Body>
              Plazore gives sellers a digital place to establish their store, present their
              products, reach buyers, manage orders, and understand how their commerce is
              performing.
            </Body>
            <Card
              icon="storefront-outline"
              title="Build"
              body="Create your store and bring your products into the Plazore marketplace."
            />
            <Card
              icon="radio-outline"
              title="Reach"
              body="Let your products participate in search, discovery, showroom activity, and marketplace visibility."
            />
            <Card
              icon="analytics-outline"
              title="Understand"
              body="See the signals behind your commerce instead of relying only on intuition."
            />
            <Card
              icon="trending-up-outline"
              title="Grow"
              body="Identify what is gaining traction, what needs attention, where opportunities may exist, and where expansion may or may not make sense."
            />
            <Text style={styles.emphasis}>
              Growth should be informed by what commerce is actually telling you.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s6')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>DISCOVERY</SectionLabel>
            <SectionTitle>Discovery Should Feel Alive.</SectionTitle>
            <Body>
              Traditional marketplaces often begin with a question: “What are you looking
              for?” Plazore also asks another:
            </Body>
            <Quote>What might you discover?</Quote>
            <Body>
              The Plazore showroom uses marketplace activity, user interaction, relevance,
              availability, product freshness, seller activity, and other commerce signals
              to continuously shape discovery. A single accidental click should not define
              someone’s experience. Meaningful signals matter more.
            </Body>
            <Body>
              This is a recommendation and discovery system built around actual marketplace
              signals — not a claim that the showroom is powered only by AI.
            </Body>
          </View>
        </FadeIn>

        <FadeIn visible={v('s7')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>PLAZORE AI</SectionLabel>
            <SectionTitle>Intelligence Inside Commerce.</SectionTitle>
            <Text style={styles.subtitle}>Plazore AI</Text>
            <Body>
              Plazore AI is designed around product and commerce intelligence — not
              conversation for conversation’s sake. It helps turn available product
              information and marketplace activity into useful context so buyers can
              understand products faster and sellers can better understand their commerce
              activity.
            </Body>
            <Card
              icon="person-outline"
              title="Buyer Intelligence"
              body="Understand a product faster, with useful context around the information available to you."
            />
            <Card
              icon="briefcase-outline"
              title="Seller Intelligence"
              body="Turn commerce activity into clearer business context and help identify meaningful changes in performance."
            />
            <Text style={styles.emphasis}>
              Plazore AI does not make every decision for you. It exists to make the
              information behind the decision more useful.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s8')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>BUYER CONFIDENCE</SectionLabel>
            <SectionTitle>Confidence Without Pretending.</SectionTitle>
            <Body>
              Plazore does not believe every product needs an artificial star rating. Buyer
              Confidence communicates how much useful supporting information and
              marketplace activity is available for a product.
            </Body>
            <View style={styles.confidenceRow}>
              <View style={[styles.confPill, styles.confHigh]}>
                <Text style={styles.confText}>HIGH CONFIDENCE</Text>
              </View>
              <View style={[styles.confPill, styles.confGrow]}>
                <Text style={styles.confText}>GROWING</Text>
              </View>
              <View style={[styles.confPill, styles.confLimited]}>
                <Text style={styles.confText}>LIMITED</Text>
              </View>
            </View>
            <Body>
              High Confidence means there is meaningful supporting information and
              marketplace activity. Growing means useful signals are developing. Limited
              means there is not yet enough supporting information or activity to provide
              stronger context.
            </Body>
            <Text style={styles.emphasis}>
              Limited does not automatically mean a product is bad. It means there is less
              information available to support a stronger conclusion.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s9')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>COMMERCE</SectionLabel>
            <SectionTitle>Built for Commerce.</SectionTitle>
            <Body>
              Plazore may feel different from a traditional marketplace, but the
              fundamentals remain familiar.
            </Body>
            <FlowRow steps={COMMERCE_FLOW} />
            <Text style={styles.emphasis}>
              The experience may evolve. The responsibility of commerce remains real.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s10')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>TRUST</SectionLabel>
            <SectionTitle>Commerce With Structure.</SectionTitle>
            <Body>
              Buying from an unfamiliar seller should not mean leaving the entire
              transaction to an informal conversation. Plazore connects payment, order
              records, delivery status, buyer confirmation, and issue handling into a
              structured marketplace flow.
            </Body>
            <Text style={styles.flowCaption}>Order path</Text>
            <FlowColumn steps={TRUST_FLOW} />
            <Text style={styles.flowCaption}>If something goes wrong</Text>
            <FlowColumn steps={ISSUE_FLOW} />
            <Text style={styles.emphasis}>
              Plazore is designed to provide a structured path for addressing problems when
              they occur — not a promise of automatic refunds in every case.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s11')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>SHOP & EARN</SectionLabel>
            <SectionTitle>The New Way to Shop and Earn.</SectionTitle>
            <Body>
              “Shop” is the buyer side: discovering products, exploring stores, making
              informed purchases, and participating in commerce.
            </Body>
            <Body>
              “Earn” is the seller side: bringing products to market, reaching buyers,
              completing transactions, and building a business.
            </Body>
            <Quote>One marketplace. Two sides of commerce.</Quote>
            <Text style={styles.emphasis}>
              Plazore exists where discovery meets opportunity.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s12')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>SURFACES</SectionLabel>
            <SectionTitle>One Commerce Ecosystem.</SectionTitle>
            <Card
              icon="desktop-outline"
              title="Web"
              body="A larger canvas for browsing, discovery, shopping, and seller operations."
            />
            <Card
              icon="phone-portrait-outline"
              title="App"
              body="A deeper, more personal Plazore experience built for continued engagement with the marketplace."
            />
            <Text style={styles.emphasis}>Different surfaces. One commerce ecosystem.</Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s13')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>DIRECTION</SectionLabel>
            <SectionTitle>We Are Chasing Something Bigger.</SectionTitle>
            <Body>
              Plazore starts with commerce because commerce is one of humanity’s oldest
              systems. People have always bought. People have always sold. People have
              always tried to understand demand, manage risk, find opportunity, and make a
              profit. Technology has changed how those things happen. Plazore wants to push
              that evolution further.
            </Body>
            <Quote>
              From manually operated commerce toward increasingly autonomous commerce.
            </Quote>
            <Body>
              A world where systems can observe what is happening, understand what it
              means, carry out routine actions, identify problems, and continuously improve
              the way commerce operates — while humans remain responsible for the decisions
              that truly require human judgment.
            </Body>
            <Text style={styles.emphasis}>
              Commerce is the beginning. Fully autonomous commerce is a direction we are
              pursuing — not a claim of what is already complete.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s14')} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <SectionLabel>PRINCIPLE</SectionLabel>
            <SectionTitle>Different by Design.</SectionTitle>
            <Body>Plazore isn’t trying to make e-commerce look prettier.</Body>
            <Quote>It’s trying to make commerce feel different.</Quote>
            <Body>
              The unfamiliar experience is intentional. The familiar fundamentals are
              intentional. The intelligence is intentional. The simplicity is intentional.
            </Body>
            <Text style={styles.emphasis}>
              The goal is not technology for technology’s sake. The goal is technology that
              makes commerce work better.
            </Text>
          </View>
        </FadeIn>

        <FadeIn visible={v('s15')} reduceMotion={reduceMotion}>
          <LinearGradient
            colors={['rgba(0,229,117,0.08)', 'rgba(59,130,246,0.1)', 'rgba(9,11,15,0)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.closing}
          >
                        <Image source={LOGO} style={styles.closingLogo} resizeMode="contain" />
            <Text style={styles.closingTag}>THE NEW WAY TO SHOP AND EARN.</Text>
            <Text style={styles.closing2040}>BUY AND SELL LIKE IT’S 2040.</Text>
            <Text style={styles.closingLine}>
              Discover differently. Buy confidently. Sell intelligently.
            </Text>
          </LinearGradient>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    gap: 6,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { flex: 1, color: TEXT, fontSize: 17, fontWeight: '700' },
  topVer: { color: MUTED, fontSize: 12, fontWeight: '600', marginRight: 8 },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
  },
  logo: { width: 190, height: 220, marginBottom: -40 },
  brand: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
  },
  tagline: {
    marginTop: 10,
    color: GREEN,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  heroBody: {
    marginTop: 16,
    color: SECONDARY,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  section: { paddingHorizontal: 20, paddingBottom: 36 },
  sectionLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 14,
    lineHeight: 30,
  },
  subtitle: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '700',
    marginTop: -6,
    marginBottom: 12,
  },
  body: {
    color: SECONDARY,
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 12,
  },
  monoLine: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 14,
    marginTop: 4,
  },
  emphasis: {
    color: TEXT,
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 6,
  },
  quoteWrap: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 14,
    paddingVertical: 4,
  },
  quoteBar: { width: 3, borderRadius: 2, backgroundColor: GREEN },
  quote: {
    flex: 1,
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,117,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: { color: TEXT, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  cardBody: { color: SECONDARY, fontSize: 13.5, lineHeight: 20 },
  flowCol: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  flowStep: { position: 'relative', paddingLeft: 22, paddingBottom: 14 },
  flowDot: {
    position: 'absolute',
    left: 0,
    top: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  flowLine: {
    position: 'absolute',
    left: 3,
    top: 16,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0,229,117,0.25)',
  },
  flowText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  flowCaption: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  flowRowItem: { flexDirection: 'row', alignItems: 'center' },
  flowRowText: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  confidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  confPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confHigh: {
    backgroundColor: 'rgba(0,229,117,0.14)',
    borderColor: 'rgba(0,229,117,0.35)',
  },
  confGrow: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  confLimited: { backgroundColor: SURFACE_2, borderColor: LINE },
  confText: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closing: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.2)',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  closingLogo: { width: 140, height: 140, marginBottom: -18 },
  closingBrand: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 5,
  },
  closingTag: {
    marginTop: 10,
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  closing2040: {
    marginTop: 14,
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  closingLine: {
    marginTop: 16,
    color: SECONDARY,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
})