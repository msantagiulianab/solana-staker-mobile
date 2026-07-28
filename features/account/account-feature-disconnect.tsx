import { Button } from 'react-native'
import React, { useCallback } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-kit'

export function AccountFeatureDisconnect() {
  const { account, disconnect } = useMobileWallet()

  const handleDisconnect = useCallback(async () => {
    await disconnect()
  }, [disconnect])

  return <Button disabled={!account} title="Disconnect" onPress={handleDisconnect} />
}
