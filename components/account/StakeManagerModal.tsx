/**
 * StakeManagerModal — modal to manage individual stake accounts.
 *
 * Props:
 *   - stakeAccount: StakeAccountInfo — the account to display/manage
 *   - visible: boolean — show/hide the modal
 *   - onClose: () => void — called when the user dismisses the modal
 *
 * Functionality:
 *   - Displays pubkey, status, delegated amount (SOL), voter pubkey
 *   - Shows "Deactivate Stake" button only for active/activating states
 *   - Wires deactivation to the createHandleDeactivate pure factory
 *
 * UI: React Native Modal + Pressable (close button).
 *     Pressable wires the close callback; deactivate button wiring is tested
 *     via the pure createHandleDeactivate call verification.
 */

import React, { useMemo } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { createHandleDeactivate } from '@/features/staking/deactivate-stake'
import { lamportsToSol } from '@/utils/lamports-to-sol'
import {
  STAKE_STATE_LABELS,
  getStakeStateColor,
} from '@/features/staking/PortfolioDashboard'
import type { StakeAccountInfo } from '@/features/staking/use-get-stake-accounts'

// ---------------------------------------------------------------------------
// Pure helper — exported for direct testing
// ---------------------------------------------------------------------------

export function showDeactivateButton(
  state: StakeAccountInfo['state'],
): boolean {
  return state === 'active' || state === 'activating'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  stakeAccount: StakeAccountInfo
  visible: boolean
  onClose: () => void
}

export function StakeManagerModal({
  stakeAccount,
  visible,
  onClose,
}: Props) {
  const { account, sendTransactions } = useMobileWallet()

  const handleDeactivate = useMemo(() => {
    return createHandleDeactivate(
      stakeAccount.pubkey,
      account?.address,
      sendTransactions as any,
    )
  }, [stakeAccount.pubkey, account?.address, sendTransactions])

  const canDeactivate = showDeactivateButton(stakeAccount.state)

  const delegatedSol =
    stakeAccount.delegatedAmount != null
      ? `${lamportsToSol(stakeAccount.delegatedAmount).toFixed(2)} SOL`
      : 'N/A'

  const stateColor = getStakeStateColor(stakeAccount.state)
  const stateLabel = STAKE_STATE_LABELS[stakeAccount.state]

  const voterDisplay = stakeAccount.voterPubkey ?? 'N/A'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <AppView style={styles.container} testID="stake-manager-modal">
          {/* Header */}
          <AppView style={styles.header}>
            <AppText type="subtitle">Stake Account</AppText>
            <Pressable testID="stake-manager-close" onPress={onClose}>
              <AppText style={styles.closeText}>✕</AppText>
            </Pressable>
          </AppView>

          <ScrollView style={styles.body}>
            {/* Pubkey */}
            <AppView style={styles.row}>
              <AppText type="defaultSemiBold">Address</AppText>
              <AppText style={styles.valueText} selectable>
                {stakeAccount.pubkey}
              </AppText>
            </AppView>

            {/* Status */}
            <AppView style={styles.row}>
              <AppText type="defaultSemiBold">Status</AppText>
              <AppText style={{ color: stateColor, fontWeight: '700' }}>
                {stateLabel}
              </AppText>
            </AppView>

            {/* Delegated Amount */}
            <AppView style={styles.row}>
              <AppText type="defaultSemiBold">Delegated</AppText>
              <AppText>{delegatedSol}</AppText>
            </AppView>

            {/* Voter */}
            <AppView style={styles.row}>
              <AppText type="defaultSemiBold">Validator</AppText>
              <AppText style={styles.valueTextSmall} selectable>
                {voterDisplay}
              </AppText>
            </AppView>
          </ScrollView>

          {/* Actions */}
          {canDeactivate && (
            <AppView style={styles.actions}>
              <Pressable
                testID="deactivate-stake-button"
                style={styles.deactivateButton}
                onPress={handleDeactivate}
              >
                <AppText style={styles.deactivateButtonText}>
                  Deactivate Stake
                </AppText>
              </Pressable>
            </AppView>
          )}
        </AppView>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  container: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeText: {
    fontSize: 22,
    fontWeight: '600',
    padding: 4,
  },
  body: {
    flexGrow: 0,
  },
  row: {
    marginBottom: 12,
  },
  valueText: {
    marginTop: 2,
    fontSize: 14,
  },
  valueTextSmall: {
    marginTop: 2,
    fontSize: 13,
  },
  actions: {
    marginTop: 20,
    alignItems: 'center',
  },
  deactivateButton: {
    backgroundColor: '#F44336',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  deactivateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
})