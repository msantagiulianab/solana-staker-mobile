import { useEffect, useState } from 'react'
import { AppState, ColorSchemeName, useColorScheme as useRNColorScheme } from 'react-native'
import type { ColorScheme } from '@/constants/colors'

export function normalizeColorScheme(scheme: ColorSchemeName): ColorScheme {
  return scheme === 'dark' ? 'dark' : 'light'
}

export function useColorScheme(): ColorScheme {
  const colorScheme = useRNColorScheme()
  const [scheme, setScheme] = useState<ColorScheme>(normalizeColorScheme(colorScheme))

  useEffect(() => {
    const subscription = AppState.addEventListener('change', () => {
      // Re-read the color scheme when the app comes to foreground
    })
    return () => {
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    setScheme(normalizeColorScheme(colorScheme))
  }, [colorScheme])

  return scheme
}