import React from 'react'
import { View, type ViewProps } from 'react-native'
import { useThemeColor } from '@/hooks/use-theme-color'

export function AppView({ style, ...props }: ViewProps) {
  const backgroundColor = useThemeColor({}, 'background')
  return (
    <View
      style={[{ gap: 8, backgroundColor }, style]}
      {...props}
    />
  )
}