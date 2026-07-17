import React from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { useGetStakeAccounts, type StakeAccountInfo } from '@/features/staking/use-get-stake-accounts'
import { ellipsify } from '@/utils/ellipsify'
import { lamportsToSol } from '@/utils/lamports-to-sol'
import type { Address } from '@solana/kit'

// ---------------------------------------------------------------------------
// Pure helpers (exported for direct testing)
// ---------------------------------------------------------------------------

export const STAKE_STATE_LABELS: Record<StakeAccountInfo['state'], string> = {
  active: 'Active',
  activating: 'Activating',
  deactivating: 'Deactivating',
  inactive: 'Inactive',
}

const STAKE_STATE_COLORS: Record<StakeAccountInfo['state'], string> = {
  active: '#4CAF50',
  activating: '#FF9800',
  deactivating: '#F44336',
  inactive: '#9E9E9E',
}

export function getStakeStateColor(state: StakeAccountInfo['state']): string {
  return STAKE_STATE_COLORS[state]
}

function formatDelegatedAmount(account: StakeAccountInfo): string {
  if (account.delegatedAmount == null) {
    return 'N/A'
  }
  return `${lamportsToSol(account.delegatedAmount).toFixed(2)} SOL`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioDashboard({ address }: { address: string }) {
  const { data, isLoading, isError } = useGetStakeAccounts({ address: address as Address })

  if (isLoading) {
    return (
      <AppView style={styles.centered}>
        <AppText>Loading stake accounts...</AppText>
      </AppView>
    )
  }

  if (isError) {
    return (
      <AppView style={styles.centered}>
        <AppText>Failed to load stake accounts.</AppText>
      </AppView>
    )
  }

  if (!data || data.length === 0) {
    return (
      <AppView style={styles.centered}>
        <AppText>No stake accounts found.</AppText>
      </AppView>
    )
  }

  return (
    <AppView style={styles.container}>
      <AppText type="subtitle" style={styles.title}>
        Your Stake Accounts
      </AppText>
      <FlatList
        data={data}
        keyExtractor={(item) => item.pubkey}
        testID="stake-account-list"
        renderItem={({ item }) => (
          <AppView style={styles.card}>
            <AppView style={styles.row}>
              <AppText style={styles.pubkey}>{ellipsify(item.pubkey)}</AppText>
              <AppText
                style={[styles.stateBadge, { color: getStakeStateColor(item.state) }]}
              >
                {STAKE_STATE_LABELS[item.state]}
              </AppText>
            </AppView>
            <AppView style={styles.row}>
              <AppText type="defaultSemiBold">{formatDelegatedAmount(item)}</AppText>
              {item.voterPubkey && (
                <AppText style={styles.voterLabel}>
                  Vote: {ellipsify(item.voterPubkey)}
                </AppText>
              )}
            </AppView>
          </AppView>
        )}
      />
    </AppView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pubkey: {
    fontSize: 14,
  },
  stateBadge: {
    fontSize: 13,
    fontWeight: '700',
  },
  voterLabel: {
    fontSize: 12,
    color: '#888',
  },
})