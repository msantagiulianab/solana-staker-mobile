import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppView } from '@/components/ui/app-view'
import type { ViewProps } from 'react-native'

export function AppPage({ style, children, ...props }: ViewProps) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <AppView style={[{ flex: 1, gap: 16, paddingHorizontal: 16 }, style]} {...props}>
        {children}
      </AppView>
    </SafeAreaView>
  )
}