import React, { useMemo, useState } from 'react'
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const GREEN = '#00E575'
const TEAL = '#14B8A6'
const BLUE = '#3B82F6'
const MUTED = '#6B8299'
const DIM = '#4A6078'
const TEXT = '#F5F7FA'
const SURFACE = '#0A121C'
const LINE = 'rgba(255,255,255,0.06)'

type SeriesPoint = {
  label?: string
  value?: number
  views?: number
  cartAdds?: number
  cart?: number
  purchases?: number
  sales?: number
  date?: string
}

function normalize(raw: SeriesPoint[]) {
  return (raw || []).map((d, i) => {
    let label = d.label || ''
    if (!label && d.date) {
      const dt = new Date(d.date)
      label = Number.isNaN(dt.getTime())
        ? `D${i + 1}`
        : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
    if (!label) label = `${i + 1}`

    const views = Number(d.views) || 0
    const cart = Number(d.cartAdds ?? d.cart) || 0
    const purchases = Number(d.purchases ?? d.sales) || 0
    const value = Number(d.value) || views + cart * 5 + purchases * 15

    return { label, value, views, cart, purchases }
  })
}

export function DashboardPerformanceBars({
  data = [],
}: {
  data?: SeriesPoint[]
}) {
  const points = useMemo(() => normalize(data).slice(-14), [data])
  const [hover, setHover] = useState<number | null>(null)
  const [chartW, setChartW] = useState(0)

  const max = useMemo(() => {
    const m = Math.max(1, ...points.map((p) => p.value))
    const pow = Math.pow(10, Math.floor(Math.log10(m)) || 0)
    return Math.ceil(m / pow) * pow || 1
  }, [points])

  const onLayout = (e: LayoutChangeEvent) => {
    setChartW(e.nativeEvent.layout.width)
  }

  if (!points.length) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyBars}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.emptyBar,
                { height: `${18 + ((i * 17) % 55)}%` as any },
              ]}
            />
          ))}
        </View>
        <Text style={styles.emptyText}>
          Engagement will show here as buyers interact
        </Text>
      </View>
    )
  }

  const active = hover != null ? points[hover] : null
  const labelEvery = Math.max(1, Math.ceil(points.length / 5))
  const gap = 4
  const barW =
    chartW > 0
      ? Math.max(6, (chartW - gap * (points.length - 1)) / points.length)
      : 12

  return (
    <View>
      <View style={styles.row}>
        {/* Y axis */}
        <View style={styles.yCol}>
          <Text style={styles.yLabel}>{max}</Text>
          <Text style={styles.yLabel}>{Math.round(max / 2)}</Text>
          <Text style={styles.yLabel}>0</Text>
        </View>

        <View style={styles.chartCol} onLayout={onLayout}>
          {/* Grid */}
          <View style={styles.grid} pointerEvents="none">
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
          </View>

          <View style={styles.barsRow}>
            {points.map((d, i) => {
              const hPct = Math.max(4, Math.round((d.value / max) * 100))
              const isOn = hover === i
              return (
                <Pressable
                  key={i}
                  onPress={() => setHover((prev) => (prev === i ? null : i))}
                  style={[styles.barCol, { width: barW }]}
                >
                  <View style={styles.barTrack}>
                    <LinearGradient
                      colors={
                        isOn
                          ? [GREEN, TEAL, BLUE]
                          : ['rgba(0,229,117,0.85)', 'rgba(20,184,166,0.75)', 'rgba(59,130,246,0.7)']
                      }
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={[
                        styles.bar,
                        {
                          height: `${hPct}%` as any,
                          opacity: isOn ? 1 : 0.9,
                        },
                      ]}
                    />
                  </View>
                  {i % labelEvery === 0 ? (
                    <Text style={styles.xLabel} numberOfLines={1}>
                      {d.label}
                    </Text>
                  ) : (
                    <View style={styles.xLabelSpacer} />
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>

      {/* Tooltip */}
      <View style={styles.tooltip}>
        {active ? (
          <View style={styles.tooltipInner}>
            <Text style={styles.tipLabel}>{active.label}</Text>
            <Text style={styles.tipPts}>{active.value} pts</Text>
            {(active.views > 0 || active.cart > 0 || active.purchases > 0) && (
              <>
                <Text style={[styles.tipMeta, { color: BLUE }]}>
                  Views {active.views}
                </Text>
                <Text style={[styles.tipMeta, { color: TEAL }]}>
                  Cart {active.cart}
                </Text>
                <Text style={[styles.tipMeta, { color: GREEN }]}>
                  Buys {active.purchases}
                </Text>
              </>
            )}
          </View>
        ) : (
          <Text style={styles.tipHint}>
            Tap a day · score = views×1 + cart×5 + purchases×15
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  emptyWrap: {
    height: 140,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  emptyBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 28,
  },
  emptyBar: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 2,
  },
  emptyText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    textAlign: 'center',
    color: DIM,
    fontSize: 11,
  },

  row: { flexDirection: 'row', gap: 8 },
  yCol: {
    width: 28,
    height: 132,
    justifyContent: 'space-between',
    paddingBottom: 22,
    paddingTop: 2,
  },
  yLabel: {
    color: DIM,
    fontSize: 9,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chartCol: { flex: 1, height: 132 },
  grid: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingBottom: 22,
    paddingTop: 2,
  },
  gridLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  barCol: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    maxWidth: 28,
  },
  bar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 4,
  },
  xLabel: {
    marginTop: 6,
    color: DIM,
    fontSize: 9,
    maxWidth: 36,
    textAlign: 'center',
  },
  xLabelSpacer: { height: 16, marginTop: 6 },

  tooltip: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tooltipInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  tipLabel: { color: TEXT, fontWeight: '700', fontSize: 12 },
  tipPts: { color: GREEN, fontWeight: '800', fontSize: 12 },
  tipMeta: { fontSize: 12, fontWeight: '600' },
  tipHint: { color: MUTED, fontSize: 12, lineHeight: 17 },
})