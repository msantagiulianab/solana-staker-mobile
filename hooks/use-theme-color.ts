import { Colors, type ColorScheme } from '@/constants/colors'
import { useColorScheme } from '@/hooks/use-color-scheme'

export type ThemeColorKey = keyof typeof Colors.light

export interface ThemeColorProps {
  light?: string
  dark?: string
}

export function useThemeColor(props: ThemeColorProps, colorKey: ThemeColorKey): string {
  const theme = useColorScheme()
  const colorFromProps = props[theme]

  if (colorFromProps) {
    return colorFromProps
  }
  return Colors[theme][colorKey]
}