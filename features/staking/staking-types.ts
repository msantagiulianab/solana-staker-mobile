/**
 * Shared staking types, labels, and helpers.
 *
 * Extracted from PortfolioDashboard.tsx to break a circular dependency
 * between PortfolioDashboard and StakeManagerModal.
 */

import type { StakeAccountInfo } from '@/features/staking/use-get-stake-accounts'

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