import {
  convertPrice,
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
} from '@/constants/regions'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Image,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

/* ── Plazore tokens — sharp geometry ── */
const BG = '#090B0F'
const SURFACE = '#0E1116'
const SURFACE_2 = '#14181F'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#F5F7FA'
const SECONDARY = 'rgba(255,255,255,0.55)'
const MUTED = 'rgba(255,255,255,0.38)'
const GREEN = '#00E575'
const TEAL = '#14B8A6'
const BLUE = '#2563EB'
const DANGER = '#EF4444'
const GRAD = [GREEN, TEAL, BLUE] as const

const U = 8
const H_PAD = U * 2 // 16

function resolveProductRegion(product: any): string {
  if (!product) return DEFAULT_REGION
  if (product.region) return String(product.region)
  if (product.marketplaceRegion) return String(product.marketplaceRegion)
  const seller = product.seller
  if (seller && typeof seller === 'object' && seller.marketplaceRegion) {
    return String(seller.marketplaceRegion)
  }
  return DEFAULT_REGION
}

export default function Cart() {
  const { cartItems, removeFromCart, updateQuantity, updateItemNote } =
    useCart()
  const {
    format,
    formatProduct,
    region: buyerRegion,
    refreshRegion,
  } = useMarketplace()
  const router = useRouter()

  useFocusEffect(
    useCallback(() => {
      refreshRegion()
    }, [refreshRegion])
  )

  const displayRegion = buyerRegion || DEFAULT_REGION

  const fmt = useCallback(
    (amount: number) => {
      try {
        return format ? format(amount) : formatMoney(amount, displayRegion)
      } catch {
        return formatMoney(amount, displayRegion)
      }
    },
    [format, displayRegion]
  )

  const fmtProduct = useCallback(
    (amount: number, productRegion?: string | null) => {
      try {
        return formatProduct
          ? formatProduct(amount, productRegion)
          : formatProductPrice(amount, productRegion, displayRegion)
      } catch {
        return formatProductPrice(amount, productRegion, displayRegion)
      }
    },
    [formatProduct, displayRegion]
  )

  const { productPrice, deliveryFee, totalAmount } = useMemo(() => {
    if (!cartItems?.length) {
      return { productPrice: 0, deliveryFee: 0, totalAmount: 0 }
    }

    let productsSum = 0
    const bySeller: Record<string, number> = {}
    let noSellerMax = 0

    for (const item of cartItems) {
      const productRegion = resolveProductRegion(item.product)
      const unit = Number(item.price ?? item.product?.price) || 0
      const qty = Number(item.quantity) || 1

      productsSum += convertPrice(unit * qty, productRegion, displayRegion)

      const feeRaw = Number(item.product?.shipping?.deliveryFee) || 0
      const feeConverted = convertPrice(feeRaw, productRegion, displayRegion)

      const seller = item.product?.seller as any
      const sellerId =
        typeof seller === 'string'
          ? seller
          : seller?._id
            ? String(seller._id)
            : ''

      if (sellerId) {
        bySeller[sellerId] = Math.max(bySeller[sellerId] || 0, feeConverted)
      } else {
        noSellerMax = Math.max(noSellerMax, feeConverted)
      }
    }

    const feeSum =
      Object.values(bySeller).reduce((sum, fee) => sum + fee, 0) + noSellerMax

    return {
      productPrice: productsSum,
      deliveryFee: feeSum,
      totalAmount: productsSum + feeSum,
    }
  }, [cartItems, displayRegion])

  const itemCount = cartItems.reduce((n, i) => n + (i.quantity || 0), 0)

  const bagAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(bagAnim, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start()
  }, [])

  const onQty = (id: string, qty: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    if (qty < 1) {
      removeFromCart(id)
      return
    }
    updateQuantity(id, qty)
  }

  const onRemove = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    removeFromCart(id)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header — flush, no radius */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Shopping Bag</Text>
          {itemCount > 0 && (
            <Text style={styles.headerSub}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Thin accent rule under header */}
      <LinearGradient
        colors={['transparent', 'rgba(0,229,117,0.45)', 'rgba(37,99,235,0.35)', 'transparent']}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerRule}
      />

      {cartItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-handle-outline" size={36} color={MUTED} />
          </View>
          <Text style={styles.emptyTitle}>Your bag is empty</Text>
          <Text style={styles.emptySub}>
            Items you pick from Plazore will appear here — ready for checkout.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/')}
            activeOpacity={0.88}
            style={styles.emptyBtnWrap}
          >
            <LinearGradient
              colors={[...GRAD]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyBtn}
            >
              <Text style={styles.emptyBtnText}>Continue shopping</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: bagAnim,
                transform: [
                  {
                    translateY: bagAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              {cartItems.map((item) => {
                const productRegion = resolveProductRegion(item.product)
                const unit = Number(item.price ?? item.product?.price) || 0
                const qty = Number(item.quantity) || 1
                const lineTotal = unit * qty
                const lineFee =
                  Number(item.product?.shipping?.deliveryFee) || 0
                const note = item.note || ''

                return (
                  <View key={item.id} style={styles.card}>
                    {/* Left green edge accent when present */}
                    <View style={styles.cardEdge} />

                    <View style={styles.cardTop}>
                      {item.product?.images?.[0] ? (
                        <Image
                          source={{ uri: item.product.images[0] }}
                          style={styles.thumb}
                        />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Ionicons
                            name="image-outline"
                            size={22}
                            color={MUTED}
                          />
                        </View>
                      )}

                      <View style={styles.infoCol}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {item.product?.name || 'Product'}
                        </Text>

                        <Text style={styles.unitPrice} numberOfLines={1}>
                          {fmtProduct(unit, productRegion)}
                        </Text>

                        {lineFee > 0 && (
                          <Text style={styles.feeText} numberOfLines={1}>
                            Delivery {fmtProduct(lineFee, productRegion)}
                          </Text>
                        )}

                        <View style={styles.actionRow}>
                          <View style={styles.qtyControl}>
                            <TouchableOpacity
                              onPress={() => onQty(item.id, item.quantity - 1)}
                              style={styles.qtyBtn}
                              hitSlop={8}
                            >
                              <Ionicons name="remove" size={15} color={TEXT} />
                            </TouchableOpacity>
                            <Text style={styles.qtyValue}>{item.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => onQty(item.id, item.quantity + 1)}
                              style={styles.qtyBtn}
                              hitSlop={8}
                            >
                              <Ionicons name="add" size={15} color={TEXT} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.priceBlock}>
                            <Text
                              style={styles.lineTotal}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.75}
                            >
                              {fmtProduct(lineTotal, productRegion)}
                            </Text>
                          </View>

                          <TouchableOpacity
                            onPress={() => onRemove(item.id)}
                            style={styles.removeBtn}
                            hitSlop={10}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={DANGER}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <View style={styles.noteWrap}>
                      <Text style={styles.noteLabel}>Note for seller</Text>
                      <TextInput
                        value={note}
                        onChangeText={(t) => updateItemNote(item.id, t)}
                        placeholder="e.g. Pack carefully · Gift wrap · Leave at door"
                        placeholderTextColor={MUTED}
                        multiline
                        maxLength={120}
                        style={styles.noteInput}
                        textAlignVertical="top"
                      />
                      <Text style={styles.noteCount}>{note.length}/120</Text>
                    </View>
                  </View>
                )
              })}

              {/* Summary — sharp panel */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHead}>
                  <Text style={styles.summaryTitle}>ORDER SUMMARY</Text>
                </View>

                <View style={styles.summaryBody}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Product price</Text>
                    <Text style={styles.summaryValue} numberOfLines={1}>
                      {fmt(productPrice)}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Delivery fee</Text>
                    <Text style={styles.summaryValue} numberOfLines={1}>
                      {fmt(deliveryFee)}
                    </Text>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue} numberOfLines={1}>
                      {fmt(totalAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Bottom bar — square */}
          <View style={styles.bottomBar}>
            <LinearGradient
              colors={['transparent', 'rgba(0,229,117,0.35)', 'rgba(37,99,235,0.25)', 'transparent']}
              locations={[0, 0.25, 0.75, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bottomRule}
            />

            <View style={styles.bottomInner}>
              <View style={styles.bottomLeft}>
                <Text style={styles.amountDueLabel}>AMOUNT DUE</Text>
                <Text
                  style={styles.amountDueValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {fmt(totalAmount)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/(tabs)/checkout' as any)}
                activeOpacity={0.88}
                style={styles.checkoutWrap}
              >
                <LinearGradient
                  colors={[...GRAD]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.checkoutBtn}
                >
                  <Text style={styles.checkoutText}>Checkout</Text>
                  <Ionicons name="arrow-forward" size={15} color="#041412" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  /* Header — no radius */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: U,
    paddingVertical: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  headerRight: {
    width: 44,
  },
  headerRule: {
    height: 1,
    marginHorizontal: H_PAD,
  },

  /* Empty */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  emptySub: {
    fontSize: 14,
    color: SECONDARY,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
  emptyBtnWrap: {
    marginTop: 32,
    overflow: 'hidden',
  },
  emptyBtn: {
    paddingHorizontal: 32,
    paddingVertical: 15,
  },
  emptyBtnText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: U * 2,
    paddingBottom: U * 3,
  },

  /* Card — square */
  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginBottom: U * 1.5,
    overflow: 'hidden',
  },
  cardEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: GREEN,
    opacity: 0.55,
  },
  cardTop: {
    flexDirection: 'row',
    padding: U * 1.75,
    paddingLeft: U * 2,
  },
  thumb: {
    width: 76,
    height: 76,
    backgroundColor: SURFACE_2,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    marginLeft: U * 1.5,
    minWidth: 0,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 19,
    letterSpacing: -0.15,
  },
  unitPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: GREEN,
    marginTop: 5,
    letterSpacing: -0.2,
  },
  feeText: {
    fontSize: 11,
    color: MUTED,
    marginTop: 3,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  priceBlock: {
    flex: 1,
    marginHorizontal: 10,
    minWidth: 0,
  },
  lineTotal: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
  },
  removeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.2)',
  },

  /* Note */
  noteWrap: {
    paddingHorizontal: U * 2,
    paddingBottom: U * 1.75,
    paddingTop: U,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: MUTED,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  noteInput: {
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    color: TEXT,
    minHeight: 56,
    lineHeight: 18,
  },
  noteCount: {
    fontSize: 10,
    color: MUTED,
    textAlign: 'right',
    marginTop: 5,
    fontWeight: '600',
  },

  /* Summary */
  summaryCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginTop: U,
    overflow: 'hidden',
  },
  summaryHead: {
    paddingHorizontal: U * 2,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    backgroundColor: SURFACE_2,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: MUTED,
    letterSpacing: 1.4,
  },
  summaryBody: {
    padding: U * 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  summaryLabel: {
    fontSize: 13,
    color: SECONDARY,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    maxWidth: '52%',
    textAlign: 'right',
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 6,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: GREEN,
    maxWidth: '52%',
    textAlign: 'right',
    letterSpacing: -0.3,
  },

  /* Bottom — square */
  bottomBar: {
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  bottomRule: {
    height: 1,
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 14,
  },
  bottomLeft: {
    flex: 1,
    marginRight: 14,
    minWidth: 0,
  },
  amountDueLabel: {
    fontSize: 10,
    color: MUTED,
    marginBottom: 3,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  amountDueValue: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  checkoutWrap: {
    overflow: 'hidden',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 8,
  },
  checkoutText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
})