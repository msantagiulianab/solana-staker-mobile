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
    const isOnSignIn = segments[0] === 'sign-in'

    if (!isAuthenticated && inTabsGroup) {
      router.replace('/sign-in')
    } else if (isAuthenticated && isOnSignIn) {
      // Only redirect to staking when the user is explicitly on the
      // sign-in screen.  On app boot, the MobileWalletProvider restores
      // the cached account from AsyncStorage asynchronously, which fires
      // isAuthenticated: false → true while segments is still undefined
      // (root path).  Without the `isOnSignIn` guard, that transition
      // eagerly redirects to /staking without user interaction.
      router.replace('/staking')
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