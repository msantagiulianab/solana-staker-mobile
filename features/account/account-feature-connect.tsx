import { Button } from 'react-native'
import React, { useCallback, useEffect } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { useRouter } from 'expo-router'

export function AccountFeatureConnect() {
  const { account, connect } = useMobileWallet()
  const router = useRouter()

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
    try {
      console.log('[MWA:connect] ⏳ Triggering local connection pipeline...')
      await connect()
      console.log('[MWA:connect] ✅ Handshake complete, routing to staking...')
      router.replace('/staking')
    } catch (error: any) {
      console.error('[MWA:connect] ❌ Connection failed:', error)
    }
  }, [connect, router])

  return <Button disabled={!!account} title="Connect" onPress={handleConnect} />
}
