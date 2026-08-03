import React, { useMemo } from 'react'
import { View, Text, Dimensions } from 'react-native'

type Point = { date: string; score: number }

const CHART_H = 120
const BAR_GAP = 3

export function PerformanceChart({
  data,
  height = CHART_H,
}: {
  data: Point[]
  height?: number
}) {
  const max = useMemo(
    () => Math.max(1, ...data.map((d) => Number(d.score) || 0)),
    [data]
  )

  // Show last 14 points so bars stay readable on phone
  const points = useMemo(() => {
    if (!data?.length) return []
    return data.length > 14 ? data.slice(-14) : data
  }, [data])

  if (!points.length) {
    return (
      <View style={{ height }} className="items-center justify-center">
        <Text className="text-[#5A7088] text-[13px]">No activity yet</Text>
      </View>
    )
  }

  return (
    <View>
      <View
        style={{ height }}
        className="flex-row items-end justify-between px-0.5"
      >
        {points.map((p, i) => {
          const score = Number(p.score) || 0
          const h = Math.max(4, (score / max) * (height - 8))
          const isLast = i === points.length - 1
          return (
            <View
              key={`${p.date}-${i}`}
              className="flex-1 items-center justify-end"
              style={{ paddingHorizontal: BAR_GAP / 2 }}
            >
              <View
                style={{
                  height: h,
                  width: '100%',
                  borderRadius: 4,
                  backgroundColor: isLast ? '#9EC5FF' : '#2A4560',
                  opacity: score === 0 ? 0.35 : 1,
                }}
              />
            </View>
          )
        })}
      </View>

      <View className="flex-row justify-between px-0.5 mt-2">
        <Text className="text-[#4A6078] text-[10px]">
          {points[0]?.date?.slice(5) || ''}
        </Text>
        <Text className="text-[#4A6078] text-[10px]">peak {max}</Text>
        <Text className="text-[#4A6078] text-[10px]">
          {points[points.length - 1]?.date?.slice(5) || ''}
        </Text>
      </View>
    </View>
  )
}