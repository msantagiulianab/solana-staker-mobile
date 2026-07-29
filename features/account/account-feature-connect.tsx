import { Alert, Button } from 'react-native'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { useRouter } from 'expo-router'

export function AccountFeatureConnect() {
  const { account, connect } = useMobileWallet()
  const router = useRouter()

  // Interaction lock: prevents concurrent MWA handshakes from double-taps
  // or rapid re-clicks. Phantom cancels the first session when a second
  // connect() fires while one is already in flight, producing a
  // CancellationException. This ref guards against that race.
  const isConnecting = useRef(false)

  // Log the authorized public key whenever it changes
  useEffect(() => {
    if (account) {
      console.log(
        '[MWA:connect] 🔑 Authorized account:',
        'address=' + account.address?.toString(),
        'label=' + account.label,
      )
    }
  }, [account])

  const handleConnect = useCallback(async () => {
    // Gate: bail early if a connection handshake is already in flight.
    // This prevents a second connect() call from cancelling the first one.
    if (isConnecting.current) {
      console.log('[MWA:connect] ⚠️ Connection already in progress, ignoring duplicate tap')
      return
    }
    isConnecting.current = true

    try {
      console.log('[MWA:connect] ⏳ Triggering local connection pipeline...')
      // IMPORTANT: connect() MUST be called as the first async operation
      // after the user's tap gesture. Any preceding async work (fetching
      // data, network calls, etc.) invalidates the Android touch interaction
      // token, causing "Local association cancelled by user" errors.
      // router.replace() MUST NOT execute before connect() resolves. The
      // component must stay mounted until the MWA handshake completes so
      // the Android intent-receiving pipeline remains alive.
      await connect()
      console.log('[MWA:connect] ✅ Handshake complete, routing to staking...')
      // Safe to navigate now — connect() has fully resolved and delivered
      // the authorized account payload.
      router.replace('/staking')
      // Lock intentionally left true here; the component unmounts via
      // router.replace(), so the ref is garbage-collected.
    } catch (error: any) {
      console.error('[MWA:connect] ❌ Connection failed:', error)
      // Do NOT automatically retry. Android invalidates the user's touch
      // interaction token on failure, so any programmatic retry (e.g.
      // disconnect() then connect()) will always fail with
      // "Local association cancelled by user". The user must physically
      // tap the button again to initiate a fresh connection.
      Alert.alert(
        'Connection Failed',
        'Unable to connect to your wallet. Please make sure Phantom is installed and try again.',
      )
    } finally {
      // Release the interaction lock on every path. Success unmounts via
      // router.replace() so the ref is garbage-collected; failure paths
      // need the lock released so the user can tap again.
      isConnecting.current = false
    }
  }, [connect, router])

  return <Button disabled={!!account} title="Connect" onPress={handleConnect} />
}
