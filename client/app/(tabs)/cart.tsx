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

/* ── Plazore tokens ── */
const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'

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
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    updateItemNote,
  } = useCart()
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Shopping Bag
          </Text>
          {itemCount > 0 && (
            <Text style={styles.headerSub}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <View style={styles.headerRight} />
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-handle-outline" size={34} color={MUTED} />
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
              colors={[GREEN, BLUE]}
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
                      outputRange: [10, 0],
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
                            size={20}
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
                              <Ionicons name="remove" size={14} color={TEXT} />
                            </TouchableOpacity>
                            <Text style={styles.qtyValue}>{item.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => onQty(item.id, item.quantity + 1)}
                              style={styles.qtyBtn}
                              hitSlop={8}
                            >
                              <Ionicons name="add" size={14} color={TEXT} />
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
                        placeholder="e.g. Please pack carefully / Gift wrap / Leave at door…"
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

              {/* Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Bag summary</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Product Price</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>
                    {fmt(productPrice)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>
                    {fmt(deliveryFee)}
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue} numberOfLines={1}>
                    {fmt(totalAmount)}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Bottom bar */}
          <View style={styles.bottomBar}>
            <View style={styles.bottomLeft}>
              <Text style={styles.amountDueLabel}>Amount due</Text>
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
                colors={[GREEN, BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkoutBtn}
              >
                <Text style={styles.checkoutText}>Checkout</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
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

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: MUTED,
    marginTop: 1,
  },
  headerRight: {
    width: 42,
  },

  /* Empty */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: 14,
    color: SECONDARY,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
  emptyBtnWrap: {
    marginTop: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  emptyBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 24,
  },

  /* Card */
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    padding: 13,
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  unitPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: GREEN,
    marginTop: 4,
  },
  feeText: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    width: 26,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Note */
  noteWrap: {
    paddingHorizontal: 13,
    paddingBottom: 13,
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: SURFACE_2,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: TEXT,
    minHeight: 52,
    lineHeight: 18,
  },
  noteCount: {
    fontSize: 10,
    color: MUTED,
    textAlign: 'right',
    marginTop: 4,
  },

  /* Summary */
  summaryCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginTop: 4,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: SECONDARY,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
    maxWidth: '52%',
    textAlign: 'right',
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: GREEN,
    maxWidth: '52%',
    textAlign: 'right',
  },

  /* Bottom */
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 14,
  },
  bottomLeft: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  amountDueLabel: {
    fontSize: 11,
    color: SECONDARY,
    marginBottom: 2,
  },
  amountDueValue: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  checkoutWrap: {
    borderRadius: 13,
    overflow: 'hidden',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 7,
  },
  checkoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
})