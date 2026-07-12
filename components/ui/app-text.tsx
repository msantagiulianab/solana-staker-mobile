import React from 'react'
import { Text, type TextProps, StyleSheet } from 'react-native'
import { useThemeColor } from '@/hooks/use-theme-color'

export type AppTextType = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link'

interface AppTextProps extends TextProps {
  type?: AppTextType
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
})

export function AppText({ style, type = 'default', ...props }: AppTextProps) {
  const color = useThemeColor({}, 'text')

  return <Text style={[{ color }, styles[type], style]} {...props} />
}