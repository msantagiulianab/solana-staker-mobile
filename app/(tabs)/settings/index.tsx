import React from 'react'
import { AppPage } from '@/components/ui/app-page'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { ellipsify } from '@/utils/ellipsify'
import { WalletUiButtonConnect } from '@/components/solana/wallet-ui-button-connect'
import { AppConfig } from '@/constants/app-config'
import { useNetwork } from '@/features/network/use-network'
import { NetworkUiSelect } from '@/features/network/network-ui-select'
import { NetworkFeatureGetVersion } from '@/features/network/network-feature-get-version'
import { NetworkFeatureGetGenesisHash } from '@/features/network/network-feature-get-genesis-hash'

export default function SettingsScreen() {
  const { account } = useMobileWallet()
  const { selectedNetwork, networks, setSelectedNetwork } = useNetwork()

  return (
    <AppPage>
      <AppView>
        <AppText type="subtitle">Account</AppText>
        {account ? (
          <AppText>{ellipsify(account.address)}</AppText>
        ) : (
          <AppView>
            <AppText>Connect your wallet.</AppText>
            <WalletUiButtonConnect />
          </AppView>
        )}
      </AppView>
      <AppView>
        <AppText type="subtitle">App Config</AppText>
        <AppText>
          Name: <AppText style={{ fontWeight: 'bold' }}>{AppConfig.identity.name}</AppText>
        </AppText>
        <AppText>
          URI: <AppText style={{ fontWeight: 'bold' }}>{AppConfig.identity.uri}</AppText>
        </AppText>
      </AppView>
      <AppView>
        <AppText type="subtitle">Cluster</AppText>
        <NetworkUiSelect
          networks={networks}
          selectedNetwork={selectedNetwork}
          setSelectedNetwork={setSelectedNetwork}
        />
        <NetworkFeatureGetVersion />
        <NetworkFeatureGetGenesisHash />
      </AppView>
    </AppPage>
  )
}