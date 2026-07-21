/**
 * Shared staking types, labels, and helpers.
 *
 * Extracted from PortfolioDashboard.tsx to break a circular dependency
 * between PortfolioDashboard and StakeManagerModal.
 */

import type { StakeAccountInfo } from '@/features/staking/use-get-stake-accounts'

// ---------------------------------------------------------------------------
// Transaction lifecycle status
// ---------------------------------------------------------------------------

/**
 * Transaction progress checkpoints for the non-dismissible overlay.
 *
 * - IDLE:              No transaction is in flight
 * - AWAITING_SIGNATURE:Waiting for the user to approve in their wallet
 * - CONFIRMING:        Transaction submitted, waiting for block confirmation
 * - SUCCESS:           Transaction confirmed on-chain
 * - ERROR:             Transaction failed or was rejected by the user
 */
export type TransactionStatus =
  | 'IDLE'
  | 'AWAITING_SIGNATURE'
  | 'CONFIRMING'
  | 'SUCCESS'
  | 'ERROR'

// ---------------------------------------------------------------------------
// Stake state labels
// ---------------------------------------------------------------------------

export const STAKE_STATE_LABELS: Record<StakeAccountInfo['state'], string> = {
  active: 'Active',
  activating: 'Activating',
  deactivating: 'Deactivating',
  inactive: 'Inactive',
}

// ---------------------------------------------------------------------------
// Stake state colors
// ---------------------------------------------------------------------------

const STAKE_STATE_COLORS: Record<StakeAccountInfo['state'], string> = {
  active: '#4CAF50',
  activating: '#FF9800',
  deactivating: '#F44336',
  inactive: '#9E9E9E',
}

export function getStakeStateColor(state: StakeAccountInfo['state']): string {
  return STAKE_STATE_COLORS[state]
}