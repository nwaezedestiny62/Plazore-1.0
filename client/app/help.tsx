import { HELP_CATEGORIES, HELP_QUICK, type HelpArticle, type HelpCategory } from '@/constants/helpContent'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  LayoutAnimation, 
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const LOGO = require('../assets/logo-1.png')

const EASE = Easing.bezier(0.22, 1, 0.36, 1)

function softLayout() {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      280,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  )
}

function PlazoreOrbPreloader() {
  const rotation = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [rotation])
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  return (
    <View style={styles.loaderRoot}>
      <View style={styles.orbWrapper}>
        <Animated.View style={[styles.orbRing, { transform: [{ rotate }] }]} />
        <View style={styles.orbLogoWrap}>
          <Image
            source={require('@/assets/logo-1.png')}
            style={styles.orbLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  )
}

function matchesQuery(cat: HelpCategory, article: HelpArticle, q: string) {
  if (!q) return true
  const hay = `${cat.title} ${cat.intro || ''} ${article.title} ${article.body}`.toLowerCase()
  return hay.includes(q)
}

export default function HelpScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [booting, setBooting] = useState(true)
  const [query, setQuery] = useState('')
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [openArticle, setOpenArticle] = useState<string | null>(null)
  const [helpful, setHelpful] = useState<Record<string, 'yes' | 'no'>>({})
  const fade = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const t = setTimeout(() => {
      setBooting(false)
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: EASE,
        useNativeDriver: true,
      }).start()
    }, 480)
    return () => clearTimeout(t)
  }, [fade])

  const goBackSafe = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/profile' as any)
  }, [router])

  const openContact = useCallback(
    (hint?: string) => {
      const qs = hint ? `?topic=${encodeURIComponent(hint)}` : ''
      router.push(`/contact${qs}` as any)
    },
    [router],
  )

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return HELP_CATEGORIES
    return HELP_CATEGORIES.map((cat) => ({
      ...cat,
      articles: cat.articles.filter((a) => matchesQuery(cat, a, q)),
    })).filter(
      (cat) =>
        cat.articles.length > 0 ||
        (cat.intro && cat.intro.toLowerCase().includes(q)),
    )
  }, [q])

  const toggleCat = (id: string) => {
    softLayout()
    setOpenCat((prev) => (prev === id ? null : id))
    setOpenArticle(null)
  }

  const toggleArticle = (id: string) => {
    softLayout()
    setOpenArticle((prev) => (prev === id ? null : id))
  }

  const onQuick = (item: (typeof HELP_QUICK)[number]) => {
    if (item.route) {
      router.push(item.route as any)
      return
    }
    if (item.categoryId) {
      setQuery('')
      setOpenCat(item.categoryId)
      setOpenArticle(null)
    }
  }

  const markHelpful = (articleId: string, value: 'yes' | 'no') => {
    setHelpful((prev) => ({ ...prev, [articleId]: value }))
    if (value === 'no') {
      openContact('Help feedback — something was missing')
    }
  }

  if (booting) return <PlazoreOrbPreloader />

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <View style={styles.header}>
          <Pressable onPress={goBackSafe} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </Pressable>
          <Image
            source={LOGO}
            style={{ width: 36, height: 36, marginRight: 10 }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Help</Text>
            <Text style={styles.headerSub}>
              Everything you need to shop, sell, and understand Plazore.
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={query ? GREEN : MUTED} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search Help"
              placeholderTextColor={MUTED}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={MUTED} />
              </Pressable>
            ) : null}
          </View>

          {!q ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>QUICK HELP</Text>
              <View style={styles.quickGrid}>
                {HELP_QUICK.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => onQuick(item)}
                    style={styles.quickCard}
                  >
                    <View style={styles.quickIcon}>
                      <Ionicons name={item.icon as any} size={20} color={GREEN} />
                    </View>
                    <Text style={styles.quickTitle}>{item.title}</Text>
                    <Text style={styles.quickSub} numberOfLines={3}>
                      {item.subtitle}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {q
                ? `RESULTS · ${filtered.reduce((n, c) => n + c.articles.length, 0)}`
                : 'TOPICS'}
            </Text>

            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={28} color={MUTED} />
                <Text style={styles.emptyTitle}>No matching help</Text>
                <Text style={styles.emptySub}>
                  Try another phrase, or contact Plazore with your question.
                </Text>
                <Pressable onPress={() => openContact(query)} style={styles.emptyCta}>
                  <Text style={styles.emptyCtaText}>Contact Plazore</Text>
                </Pressable>
              </View>
            ) : (
              filtered.map((cat) => {
                const expanded = openCat === cat.id || !!q
                return (
                  <View key={cat.id} style={styles.catCard}>
                    <Pressable onPress={() => toggleCat(cat.id)} style={styles.catHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catTitle}>{cat.title}</Text>
                        {!!cat.intro && expanded ? (
                          <Text style={styles.catIntro}>{cat.intro}</Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={MUTED}
                      />
                    </Pressable>

                    {expanded
                      ? cat.articles.map((article) => {
                          const open =
                            openArticle === article.id ||
                            (!!q && cat.articles.length <= 3)
                          return (
                            <View key={article.id} style={styles.articleBlock}>
                              <Pressable
                                onPress={() => toggleArticle(article.id)}
                                style={styles.articleHeader}
                              >
                                <Text style={styles.articleTitle}>{article.title}</Text>
                                <Ionicons
                                  name={open ? 'remove' : 'add'}
                                  size={18}
                                  color={GREEN}
                                />
                              </Pressable>
                              {open ? (
                                <View style={styles.articleBody}>
                                  <Text style={styles.articleText}>{article.body}</Text>
                                  <View style={styles.helpfulRow}>
                                    <Text style={styles.helpfulLabel}>Was this helpful?</Text>
                                    <View style={styles.helpfulBtns}>
                                      <Pressable
                                        onPress={() => markHelpful(article.id, 'yes')}
                                        style={[
                                          styles.helpfulBtn,
                                          helpful[article.id] === 'yes' && styles.helpfulBtnOn,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.helpfulBtnText,
                                            helpful[article.id] === 'yes' &&
                                              styles.helpfulBtnTextOn,
                                          ]}
                                        >
                                          Yes
                                        </Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={() => markHelpful(article.id, 'no')}
                                        style={[
                                          styles.helpfulBtn,
                                          helpful[article.id] === 'no' && styles.helpfulBtnOn,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.helpfulBtnText,
                                            helpful[article.id] === 'no' &&
                                              styles.helpfulBtnTextOn,
                                          ]}
                                        >
                                          No
                                        </Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                  {helpful[article.id] === 'no' ? (
                                    <Text style={styles.missingHint}>
                                      Tell us what was missing — opening Contact…
                                    </Text>
                                  ) : null}
                                </View>
                              ) : null}
                            </View>
                          )
                        })
                      : null}
                  </View>
                )
              })
            )}
          </View>

          <LinearGradient
            colors={['rgba(0,229,117,0.12)', 'rgba(59,130,246,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.contactCard}
          >
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactSub}>
              We&apos;re here for Plazore. Tell us what happened and give enough detail —
              orders, payments, account, store, or something else.
            </Text>
            <Pressable onPress={() => openContact()} style={styles.contactBtn}>
              <LinearGradient
                colors={[GREEN, BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.contactBtnGrad}
              >
                <Ionicons name="chatbubbles" size={18} color={BG} />
                <Text style={styles.contactBtnText}>Contact Plazore</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loaderRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.4,
    borderColor: 'transparent',
    borderTopColor: GREEN,
    borderRightColor: BLUE,
    borderBottomColor: 'transparent',
    borderLeftColor: GREEN,
  },
  orbLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbLogo: { width: 32, height: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  headerSub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: SECONDARY,
    paddingRight: 12,
  },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 22,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  section: { marginBottom: 22 },
  sectionLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 12,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    padding: 14,
    minHeight: 118,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,117,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickTitle: { color: TEXT, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  quickSub: { color: MUTED, fontSize: 12, lineHeight: 16 },
  catCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  catTitle: { color: TEXT, fontSize: 15, fontWeight: '700' },
  catIntro: { marginTop: 6, color: SECONDARY, fontSize: 13, lineHeight: 18 },
  articleBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  articleTitle: { flex: 1, color: TEXT, fontSize: 14, fontWeight: '600' },
  articleBody: { paddingHorizontal: 14, paddingBottom: 14 },
  articleText: { color: SECONDARY, fontSize: 13.5, lineHeight: 20 },
  helpfulRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  helpfulLabel: { color: MUTED, fontSize: 12, fontWeight: '600' },
  helpfulBtns: { flexDirection: 'row', gap: 8 },
  helpfulBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE_2,
  },
  helpfulBtnOn: {
    borderColor: 'rgba(0,229,117,0.45)',
    backgroundColor: 'rgba(0,229,117,0.12)',
  },
  helpfulBtnText: { color: SECONDARY, fontSize: 12, fontWeight: '700' },
  helpfulBtnTextOn: { color: GREEN },
  missingHint: { marginTop: 8, color: MUTED, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  emptyTitle: { marginTop: 12, color: TEXT, fontSize: 16, fontWeight: '700' },
  emptySub: {
    marginTop: 6,
    color: SECONDARY,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCta: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  emptyCtaText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  contactCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.22)',
    padding: 18,
    marginTop: 8,
  },
  contactTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  contactSub: { marginTop: 8, color: SECONDARY, fontSize: 13, lineHeight: 19 },
  contactBtn: { marginTop: 16, alignSelf: 'flex-start', borderRadius: 12, overflow: 'hidden' },
  contactBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contactBtnText: { color: BG, fontSize: 14, fontWeight: '800' },
})