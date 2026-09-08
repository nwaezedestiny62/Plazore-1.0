import { Ionicons } from '@expo/vector-icons'
import React, { useMemo } from 'react'
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const BG = '#090B0F'
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'

export type AnnouncementDesign = {
  layout?: 'stack' | 'split' | 'banner'
  theme?: 'dark' | 'light' | 'brand'
  accent?: 'green' | 'amber' | 'blue' | 'neutral'
  titleSize?: 'sm' | 'md' | 'lg'
  mediaAspect?: '16:9' | '1:1' | '4:5' | 'auto'
  showMediaTop?: boolean
}

export type AnnouncementData = {
  _id?: string
  headline?: string
  body?: string
  mediaType?: 'none' | 'image' | 'video'
  mediaUrl?: string
  mediaPosterUrl?: string
  actionLabel?: string
  actionRoute?: string
  design?: AnnouncementDesign
  publishedAt?: string
}

const ACCENT: Record<string, string> = {
  green: GREEN,
  amber: '#F59E0B',
  blue: '#3B82F6',
  neutral: '#A7ADB8',
}

function aspectRatio(a?: string): number | undefined {
  if (a === '1:1') return 1
  if (a === '4:5') return 4 / 5
  if (a === 'auto') return undefined
  return 16 / 9
}

/** Absolute fill without StyleSheet.absoluteFillObject */
const absoluteFill: {
  position: 'absolute'
  top: number
  left: number
  right: number
  bottom: number
} = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}

type Props = {
  data: AnnouncementData
  onAction?: (route: string) => void
  compact?: boolean
}

export function AnnouncementCard({ data, onAction, compact }: Props) {
  const design = data.design || {}
  const accent = ACCENT[design.accent || 'green'] || GREEN
  const isLight = design.theme === 'light'
  const titleSize =
    design.titleSize === 'sm' ? 16 : design.titleSize === 'lg' ? 24 : 20
  const ratio = aspectRatio(design.mediaAspect)
  const showMedia =
    !!data.mediaType &&
    data.mediaType !== 'none' &&
    !!data.mediaUrl &&
    design.showMediaTop !== false

  const cardBg = isLight ? '#F5F7FA' : SURFACE
  const titleColor = isLight ? '#0C0F14' : TEXT
  const bodyColor = isLight ? '#4B5563' : SECONDARY

  const mediaBlock = useMemo(() => {
    if (!showMedia) return null

    const mediaStyle = [
      styles.media,
      ratio != null ? { aspectRatio: ratio } : { height: compact ? 140 : 200 },
    ]

    if (data.mediaType === 'image') {
      return (
        <Image
          source={{ uri: data.mediaUrl }}
          style={mediaStyle}
          resizeMode="cover"
        />
      )
    }

    return (
      <Pressable
        onPress={() => {
          if (data.mediaUrl) Linking.openURL(data.mediaUrl)
        }}
        style={[mediaStyle, styles.videoWrap]}
      >
        {data.mediaPosterUrl ? (
          <Image
            source={{ uri: data.mediaPosterUrl }}
            style={absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <View style={[absoluteFill, { backgroundColor: '#0C0F14' }]} />
        )}
        <View style={styles.playBtn}>
          <Ionicons name="play" size={28} color={TEXT} />
        </View>
      </Pressable>
    )
  }, [
    showMedia,
    data.mediaUrl,
    data.mediaPosterUrl,
    data.mediaType,
    ratio,
    compact,
  ])

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isLight ? 'rgba(0,0,0,0.08)' : LINE,
        },
        design.layout === 'banner' && styles.cardBanner,
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      {showMedia && design.layout !== 'split' ? mediaBlock : null}

      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { borderColor: `${accent}55` }]}>
            <Text style={[styles.badgeText, { color: accent }]}>
              ANNOUNCEMENT
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.headline,
            { color: titleColor, fontSize: titleSize, lineHeight: titleSize + 8 },
          ]}
        >
          {data.headline || 'Announcement'}
        </Text>

        {!!data.body && (
          <Text style={[styles.copy, { color: bodyColor }]}>{data.body}</Text>
        )}

        {!!data.publishedAt && (
          <Text style={styles.date}>
            {new Date(data.publishedAt).toLocaleString()}
          </Text>
        )}

        {!!data.actionLabel && !!data.actionRoute && (
          <Pressable
            onPress={() => onAction?.(data.actionRoute!)}
            style={[styles.cta, { backgroundColor: accent }]}
          >
            <Text style={styles.ctaText}>{data.actionLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color={BG} />
          </Pressable>
        )}
      </View>

      {showMedia && design.layout === 'split' ? (
        <View style={{ marginTop: 12 }}>{mediaBlock}</View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardBanner: { borderRadius: 12 },
  accentBar: { height: 3, width: '100%' },
  media: {
    width: '100%',
    backgroundColor: '#0C0F14',
  },
  videoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  body: { padding: 16 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  noReplyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  noReplyText: { fontSize: 10, color: MUTED, fontWeight: '600' },
  headline: { fontWeight: '800', letterSpacing: -0.3 },
  copy: { marginTop: 10, fontSize: 14, lineHeight: 21 },
  date: { marginTop: 12, fontSize: 11, color: MUTED },
  cta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ctaText: { fontSize: 14, fontWeight: '800', color: BG },
})

export default AnnouncementCard