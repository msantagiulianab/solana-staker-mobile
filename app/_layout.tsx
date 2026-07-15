import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { useMobileWallet } from '@wallet-ui/react-native-kit'

function RootNavigator() {
  const { account } = useMobileWallet()
  const isAuthenticated = !!account
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    const inTabsGroup = segments[0] === '(tabs)'

    if (!isAuthenticated && inTabsGroup) {
      router.replace('/sign-in')
    } else if (isAuthenticated && !inTabsGroup) {
      router.replace('/(tabs)' as never)
    }
  }, [isAuthenticated, segments])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="+not-found" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
      <StatusBar style="auto" />
    </AppProviders>
  )
}