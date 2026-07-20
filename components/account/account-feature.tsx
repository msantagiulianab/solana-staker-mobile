import React from 'react'
import { ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { AccountUiBalance } from '@/components/account/account-ui-balance'
import { useGetBalance } from '@/components/account/use-get-balance'
import { useGetTokenAccounts } from '@/components/account/use-get-token-accounts'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { ellipsify } from '@/utils/ellipsify'
import { StakingFeature } from '@/components/staking/staking-feature'
import { PortfolioDashboard } from '@/features/staking/PortfolioDashboard'
import { WalletUiButtonConnect } from '@/components/solana/wallet-ui-button-connect'
import type { Address } from '@solana/kit'

export function AccountFeature() {
  const { account } = useMobileWallet()

  if (!account) {
    return (
      <AppView style={styles.centered}>
        <AppText>Connect your wallet.</AppText>
        <WalletUiButtonConnect />
      </AppView>
    )
  }

  return <AccountFeatureConnected address={account.address} />
}

function AccountFeatureConnected({ address }: { address: string }) {
  const queryClient = useQueryClient()
  const { data: balance, isLoading } = useGetBalance({ address })
  const { data: tokenAccounts, isLoading: tokensLoading } = useGetTokenAccounts({
    address,
  })
  const [refreshing, setRefreshing] = React.useState(false)

  const onRefresh = React.useCallback(() => {
    setRefreshing(true)
    queryClient.invalidateQueries({ queryKey: ['getBalance', address] })
    queryClient.invalidateQueries({ queryKey: ['getTokenAccounts', address] })
    setTimeout(() => setRefreshing(false), 1000)
  }, [queryClient, address])

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <AppView style={styles.card}>
        <AccountUiBalance balance={balance ?? undefined} isLoading={isLoading} />
        <AppText>{ellipsify(address)}</AppText>
      </AppView>
      <AppView style={styles.card}>
        <AppText type="subtitle">Actions</AppText>
      </AppView>
      <StakingFeature />
      <PortfolioDashboard address={address as Address} />
      {tokenAccounts && tokenAccounts.length > 0 ? (
        <AppView style={styles.card}>
          <AppText type="subtitle">Token Accounts</AppText>
          {tokenAccounts.map((ta, i) => (
            <AppText key={i}>
              {ellipsify(ta.pubkey)} — {ellipsify(ta.account.data.parsed?.info?.mint ?? '')} —{' '}
              {ta.account.data.parsed?.info?.tokenAmount?.uiAmount ?? '0'}
            </AppText>
          ))}
        </AppView>
      ) : (
        <AppView style={styles.card}>
          <AppText>No token accounts found.</AppText>
        </AppView>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 8,
  },
})