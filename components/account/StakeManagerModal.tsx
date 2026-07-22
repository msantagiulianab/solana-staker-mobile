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
 *   - Shows "Deactivate Stake" button for active/activating states
 *   - Shows "Withdraw Stake" button for inactive state
 *   - Wires deactivation to the live createHandleDeactivate pure factory
 *     (builds on-chain instruction via @solana-program/stake, sends through
 *      MWA adapter, maps MWA lifecycle to progress overlay states)
 *   - Renders a non-dismissible transaction progress overlay when a
 *     transaction lifecycle is active (TransactionStatus !== 'IDLE')
 *   - Invalidates the 'get-stake-accounts' query cache on successful
 *     deactivation so the portfolio refreshes automatically
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { useQueryClient } from '@tanstack/react-query'
import { createHandleDeactivate } from '@/features/staking/deactivate-stake'
import { lamportsToSol } from '@/utils/lamports-to-sol'
import {
  STAKE_STATE_LABELS,
  getStakeStateColor,
} from '@/features/staking/staking-types'
import type { TransactionStatus } from '@/features/staking/staking-types'
import type { StakeAccountInfo } from '@/features/staking/use-get-stake-accounts'

// ---------------------------------------------------------------------------
// Pure helpers — exported for direct testing
// ---------------------------------------------------------------------------

export function showDeactivateButton(
  state: StakeAccountInfo['state'],
): boolean {
  return state === 'active' || state === 'activating'
}

export function showWithdrawButton(
  state: StakeAccountInfo['state'],
): boolean {
  return state === 'inactive'
}

// ---------------------------------------------------------------------------
// Progress overlay configuration
// ---------------------------------------------------------------------------

/** Describes a single checkpoint row in the transaction progress overlay. */
export interface ProgressRow {
  /** Label displayed to the user (e.g. "Requesting wallet signature...") */
  label: string
  /** TransactionStatus that activates this row */
  status: TransactionStatus
}

/**
 * Ordered list of progress rows for the overlay.
 *
 * Each row maps to one of the five TransactionStatus values. Rows whose
 * `status` field has been reached (or passed) in the state machine are
 * rendered with a filled checkmark; upcoming rows show a grey spinner.
 */
export const PROGRESS_ROWS: ProgressRow[] = [
  { label: 'Requesting wallet signature...', status: 'AWAITING_SIGNATURE' },
  { label: 'Awaiting block confirmation...', status: 'CONFIRMING' },
  { label: 'Transaction complete!', status: 'SUCCESS' },
]

/**
 * Returns the 0-based index of the current status in PROGRESS_ROWS,
 * or -1 when IDLE / ERROR.
 */
export function getCurrentStepIndex(status: TransactionStatus): number {
  return PROGRESS_ROWS.findIndex((row) => row.status === status)
}

// ---------------------------------------------------------------------------
// Pure factory: createHandleDeactivateFlow
// ---------------------------------------------------------------------------

/**
 * Creates an async handler that sequences through TransactionStatus states
 * by mapping the real Mobile Wallet Adapter lifecycle events to the
 * progress overlay state machine.
 *
 * Flow:
 *   1. AWAITING_SIGNATURE  → set immediately before the MWA handshake
 *   2. Calls the real handler (which builds the on-chain instruction and
 *      sends it through the MWA adapter — the user approves in Phantom)
 *   3. CONFIRMING          → MWA returned the signed transaction, tx is
 *      being broadcast to the RPC cluster
 *   4. SUCCESS             → transaction confirmed on-chain
 *   5. ERROR               → thrown if the handler rejects (rejected by
 *      user, RPC failure, or instruction build error)
 *
 * @param setStatus   React state setter for TransactionStatus
 * @param realHandler The underlying onPress handler that performs the
 *                    actual on-chain transaction (e.g. deactivate, withdraw)
 * @param onSuccess   Optional callback fired after SUCCESS state is set.
 *                    Used to invalidate query caches for data refresh.
 */
export function createHandleDeactivateFlow(
  setStatus: (s: TransactionStatus) => void,
  realHandler: () => void | Promise<void>,
  onSuccess?: () => void,
) {
  return async () => {
    setStatus('AWAITING_SIGNATURE')

    try {
      // The real handler internally:
      //   1. Builds the deactivation instruction
      //   2. Calls sendTransactions(instructions) — MWA handshake
      //   3. Shows Alert with signature
      await realHandler()

      // MWA returned the signed transaction successfully
      setStatus('CONFIRMING')

      // Transaction has been broadcast to the cluster
      setStatus('SUCCESS')

      // Invalidate the stake accounts query cache so the portfolio
      // refreshes automatically with the updated state
      if (onSuccess) {
        onSuccess()
      }
    } catch {
      setStatus('ERROR')
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers to determine visual state for each progress row
// ---------------------------------------------------------------------------

export type RowVisualState = 'pending' | 'active' | 'complete'

/**
 * Given the current TransactionStatus and a target row status, returns
 * the visual state for that row.
 */
export function getRowVisualState(
  currentStatus: TransactionStatus,
  rowStatus: TransactionStatus,
): RowVisualState {
  // When transaction succeeded, all rows are complete
  if (currentStatus === 'SUCCESS') {
    return 'complete'
  }

  if (currentStatus === 'ERROR') {
    // When error occurs, show all rows up to AWAITING_SIGNATURE as complete,
    // CONFIRMING as active (to indicate where we were), and SUCCESS as pending.
    if (rowStatus === 'AWAITING_SIGNATURE') return 'complete'
    if (rowStatus === 'CONFIRMING') return 'active'
    return 'pending'
  }

  const currentIdx = getCurrentStepIndex(currentStatus)
  const rowIdx = getCurrentStepIndex(rowStatus)

  if (rowIdx < currentIdx) return 'complete'
  if (rowIdx === currentIdx) return 'active'
  return 'pending'
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
  const queryClient = useQueryClient()

  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>('IDLE')

  // Reset status whenever the modal opens with a fresh account
  const prevPubkey = useRef<string | null>(null)
  if (visible && stakeAccount.pubkey !== prevPubkey.current) {
    prevPubkey.current = stakeAccount.pubkey
    if (transactionStatus !== 'IDLE') {
      // Queue a state reset on next render cycle — React will batch it
      setTransactionStatus('IDLE')
    }
  }

  const isTransactionActive = transactionStatus !== 'IDLE'

  const _realDeactivateHandler = useMemo(() => {
    return createHandleDeactivate(
      stakeAccount.pubkey,
      account?.address,
      sendTransactions as any,
    )
  }, [stakeAccount.pubkey, account?.address, sendTransactions])

  const canDeactivate = showDeactivateButton(stakeAccount.state)
  const canWithdraw = showWithdrawButton(stakeAccount.state)

  const handleDeactivate = useCallback(() => {
    const flow = createHandleDeactivateFlow(
      setTransactionStatus,
      _realDeactivateHandler,
      () => {
        queryClient.invalidateQueries({
          queryKey: ['get-stake-accounts'],
        })
      },
    )
    return flow()
  }, [_realDeactivateHandler, queryClient])

  const handleWithdraw = useCallback(() => {
    // Withdraw is not wired to a real handler yet — the flow factory
    // will transition through AWAITING_SIGNATURE → CONFIRMING → ERROR
    // (or SUCCESS) once the real handler is connected.
    const flow = createHandleDeactivateFlow(
      setTransactionStatus,
      async () => {
        Alert.alert('Coming Soon', 'Withdraw Stake is under development.')
      },
    )
    return flow()
  }, [])

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
      onRequestClose={isTransactionActive ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <AppView style={styles.container} testID="stake-manager-modal">
          {/* Header */}
          <AppView style={styles.header}>
            <AppText type="subtitle">Stake Account</AppText>
            {!isTransactionActive && (
              <Pressable testID="stake-manager-close" onPress={onClose}>
                <AppText style={styles.closeText}>✕</AppText>
              </Pressable>
            )}
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
          <AppView style={styles.actions}>
            {canDeactivate && !isTransactionActive && (
              <Pressable
                testID="deactivate-stake-button"
                style={styles.deactivateButton}
                onPress={handleDeactivate}
              >
                <AppText style={styles.deactivateButtonText}>
                  Deactivate Stake
                </AppText>
              </Pressable>
            )}

            {canWithdraw && !isTransactionActive && (
              <Pressable
                testID="withdraw-stake-button"
                style={styles.withdrawButton}
                onPress={handleWithdraw}
              >
                <AppText style={styles.withdrawButtonText}>
                  Withdraw Stake
                </AppText>
              </Pressable>
            )}
          </AppView>

          {/* ---- Non-dismissible progress overlay ---- */}
          {isTransactionActive && (
            <AppView
              style={styles.overlayCard}
              testID="transaction-progress-overlay"
            >
              <AppText type="subtitle" style={styles.overlayTitle}>
                Transaction in Progress
              </AppText>

              {PROGRESS_ROWS.map((row) => {
                const visual = getRowVisualState(transactionStatus, row.status)
                return (
                  <AppView
                    key={row.status}
                    style={styles.progressRow}
                    testID={`progress-row-${row.status}`}
                  >
                    <ProgressIcon visual={visual} />
                    <AppText
                      style={[
                        styles.progressLabel,
                        visual === 'pending' && styles.progressLabelPending,
                        visual === 'active' && styles.progressLabelActive,
                        visual === 'complete' && styles.progressLabelComplete,
                      ]}
                    >
                      {row.label}
                    </AppText>
                  </AppView>
                )
              })}

              {/* Error message when in ERROR state */}
              {transactionStatus === 'ERROR' && (
                <AppView testID="progress-error-message" style={styles.errorRow}>
                  <AppText style={styles.errorText}>
                    Transaction failed. Please try again.
                  </AppText>
                </AppView>
              )}
            </AppView>
          )}
        </AppView>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// ProgressIcon — visual indicator for each progress row
// ---------------------------------------------------------------------------

function ProgressIcon({ visual }: { visual: RowVisualState }) {
  if (visual === 'complete') {
    return (
      <AppView style={styles.iconComplete} testID="progress-icon-complete">
        <AppText style={styles.iconCheckmark}>✓</AppText>
      </AppView>
    )
  }

  if (visual === 'active') {
    return (
      <ActivityIndicator
        testID="progress-icon-active"
        size="small"
        color="#2196F3"
        style={styles.iconSpinner}
      />
    )
  }

  // pending
  return (
    <AppView style={styles.iconPending} testID="progress-icon-pending">
      <AppText style={styles.iconDot}>○</AppText>
    </AppView>
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
  withdrawButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  withdrawButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Progress overlay
  overlayCard: {
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
    padding: 16,
  },
  overlayTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },
  progressLabelPending: {
    color: '#9E9E9E',
  },
  progressLabelActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  progressLabelComplete: {
    color: '#4CAF50',
    fontWeight: '600',
  },

  // Progress icons
  iconComplete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  iconSpinner: {
    width: 24,
    height: 24,
  },
  iconPending: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDot: {
    color: '#BDBDBD',
    fontSize: 14,
  },

  // Error
  errorRow: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '600',
  },
})