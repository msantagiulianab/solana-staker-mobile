import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { PropsWithChildren } from 'react'
import React from 'react'

export function AppTheme({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme()
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {children}
    </ThemeProvider>
  )
}