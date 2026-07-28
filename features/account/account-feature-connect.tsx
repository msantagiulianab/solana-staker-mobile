import { Alert, Button } from 'react-native'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { useRouter } from 'expo-router'

export function AccountFeatureConnect() {
  const { account, connect, disconnect } = useMobileWallet()
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
      // IMPORTANT: router.replace() MUST NOT execute before connect()
      // resolves. The component must stay mounted until the MWA handshake
      // completes so the Android intent-receiving pipeline remains alive.
      await connect()
      console.log('[MWA:connect] ✅ Handshake complete, routing to staking...')
      // Safe to navigate now — connect() has fully resolved and delivered
      // the authorized account payload.
      router.replace('/staking')
      // Lock intentionally left true here; the component unmounts via
      // router.replace(), so the ref is garbage-collected.
    } catch (error: any) {
      console.error('[MWA:connect] ❌ Connection failed:', error)

      // Wipe the stale authToken from AsyncStorage to break the zombie-token
      // loop.  Once the cache is cleared, the next authorizeSession() call
      // will skip the reauthorize path and perform a clean authorize instead.
      try {
        console.log('[MWA:connect] 🔄 Clearing stale authToken from storage...')
        await disconnect()
        console.log('[MWA:connect] 🔄 Stale token cleared — retrying with clean authorize...')
        await connect()
        console.log('[MWA:connect] ✅ Clean authorize complete, routing to staking...')
        router.replace('/staking')
        // Lock intentionally left true here; navigation unmounts the component.
      } catch (retryError: any) {
        console.error('[MWA:connect] ❌ Clean authorize also failed:', retryError)
        Alert.alert(
          'Connection Failed',
          'Unable to connect to your wallet. Please make sure Phantom is installed and try again.',
        )
      } finally {
        // Release the interaction lock on every failure path so the user
        // can tap again. This covers CancellationException, timeouts,
        // disconnect() failures, and any other error that leaves the
        // component mounted.
        isConnecting.current = false
      }
    }
  }, [connect, disconnect, router])

  return <Button disabled={!!account} title="Connect" onPress={handleConnect} />
}
