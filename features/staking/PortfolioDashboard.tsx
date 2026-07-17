import React, { useState } from 'react'
import { FlatList, Pressable, StyleSheet } from 'react-native'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import {
  useGetStakeAccounts,
  type StakeAccountInfo,
} from '@/features/staking/use-get-stake-accounts'
import { StakeManagerModal } from '@/components/account/StakeManagerModal'
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

/**
 * Pure factory: creates a handler that, when called, selects a stake account
 * and sets the selected index state.
 *
 * This is extracted so the selection logic can be tested without rendering
 * any component or fighting RNTL's Pressability constraint.
 */
export function createHandleSelectStakeAccount(
  account: StakeAccountInfo,
  setSelectedAccount: (a: StakeAccountInfo) => void,
  setModalVisible: (v: boolean) => void,
) {
  return () => {
    setSelectedAccount(account)
    setModalVisible(true)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  const { data, isLoading, isError } = useGetStakeAccounts({
    address: address as Address,
  })

  const [selectedAccount, setSelectedAccount] =
    useState<StakeAccountInfo | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

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
        renderItem={({ item }) => {
          const handleSelect = createHandleSelectStakeAccount(
            item,
            setSelectedAccount,
            setModalVisible,
          )

          return (
            <Pressable onPress={handleSelect}>
              <AppView style={styles.card}>
                <AppView style={styles.row}>
                  <AppText style={styles.pubkey}>
                    {ellipsify(item.pubkey)}
                  </AppText>
                  <AppText
                    style={[
                      styles.stateBadge,
                      { color: getStakeStateColor(item.state) },
                    ]}
                  >
                    {STAKE_STATE_LABELS[item.state]}
                  </AppText>
                </AppView>
                <AppView style={styles.row}>
                  <AppText type="defaultSemiBold">
                    {formatDelegatedAmount(item)}
                  </AppText>
                  {item.voterPubkey && (
                    <AppText style={styles.voterLabel}>
                      Vote: {ellipsify(item.voterPubkey)}
                    </AppText>
                  )}
                </AppView>
              </AppView>
            </Pressable>
          )
        }}
      />

      {/* StakeManagerModal — render when an account is selected */}
      {selectedAccount && (
        <StakeManagerModal
          stakeAccount={selectedAccount}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
      )}
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