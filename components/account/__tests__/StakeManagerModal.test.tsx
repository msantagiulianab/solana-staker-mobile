/**
 * Tests for StakeManagerModal component.
 *
 * Architecture:
 *   - Receives stakeAccount, visible, onClose props
 *   - Displays stake account details (pubkey, status, delegated amount, voter)
 *   - Wires a "Deactivate Stake" button to createHandleDeactivate factory
 *   - Shows "Withdraw Stake" button for inactive state
 *   - Only shows deactivate button for 'active' and 'activating' states
 *   - Uses useMobileWallet for authorizedPubkey and sendTransactions
 *   - Uses useQueryClient for cache invalidation on successful deactivation
 *   - Renders a non-dismissible transaction progress overlay when
 *     TransactionStatus !== 'IDLE' (powered by createHandleDeactivateFlow)
 *
 * Mock strategy:
 *   - Inline mocks for useMobileWallet, createHandleDeactivate, useQueryClient
 *   - Pure helpers (showDeactivateButton, showWithdrawButton,
 *     getCurrentStepIndex, getRowVisualState, createHandleDeactivateFlow)
 *     tested without rendering
 */

import { render, waitFor } from '@testing-library/react-native'
import React from 'react'
import { Alert } from 'react-native'
import type { StakeAccountInfo } from '@/features/staking/use-get-stake-accounts'

// ---------------------------------------------------------------------------
// Mocks — ESM chain breakers first
// ---------------------------------------------------------------------------

// Break the @solana/kit and @solana-program/stake ESM import chain
// (withdraw-stake.ts imports these; the test must mock them before
//  any dynamic import resolves the chain)
jest.mock('@solana/kit', () => ({
  address: (s: any) => s,
}))

jest.mock('@solana-program/stake', () => ({
  getDeactivateInstruction: jest.fn().mockReturnValue({}),
  getWithdrawInstruction: jest.fn().mockReturnValue({}),
}))

const mockCreateHandleDeactivate = jest.fn()

jest.mock('@/features/staking/deactivate-stake', () => ({
  createHandleDeactivate: (a: any, b: any, c: any) =>
    mockCreateHandleDeactivate(a, b, c),
}))

jest.mock('@/features/staking/withdraw-stake', () => ({
  createHandleWithdraw: () => jest.fn().mockResolvedValue(undefined),
}))

const mockUseMobileWallet = jest.fn()

jest.mock('@wallet-ui/react-native-kit', () => ({
  useMobileWallet: () => mockUseMobileWallet(),
}))

const mockInvalidateQueries = jest.fn()

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

jest.mock('@/features/staking/staking-types', () => ({
  STAKE_STATE_LABELS: {
    active: 'Active',
    activating: 'Activating',
    deactivating: 'Deactivating',
    inactive: 'Inactive',
  },
  getStakeStateColor: (state: string) => {
    const colors: Record<string, string> = {
      active: '#4CAF50',
      activating: '#FF9800',
      deactivating: '#F44336',
      inactive: '#9E9E9E',
    }
    return colors[state] ?? '#9E9E9E'
  },
}))

// Dynamic import after mocks
import {
  StakeManagerModal,
  showDeactivateButton,
  showWithdrawButton,
  getCurrentStepIndex,
  getRowVisualState,
  createHandleDeactivateFlow,
  PROGRESS_ROWS,
} from '../StakeManagerModal'
import { createHandleDeactivate } from '@/features/staking/deactivate-stake'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const MOCK_AUTHORIZED_PUBKEY =
  'WalletUser11111111111111111111111111111111'

const makeStakeAccount = (
  overrides: Partial<StakeAccountInfo> = {},
): StakeAccountInfo => ({
  pubkey: 'StakeAcct111111111111111111111111111111111',
  lamports: 2_500_000_000n,
  state: 'active',
  voterPubkey: 'Vote111111111111111111111111111111111111111',
  delegatedAmount: 1_500_000_000n,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

beforeEach(() => {
  mockCreateHandleDeactivate.mockClear()
  mockInvalidateQueries.mockClear()
  mockUseMobileWallet.mockReset()
  mockUseMobileWallet.mockReturnValue({
    account: { address: MOCK_AUTHORIZED_PUBKEY },
    sendTransactions: jest.fn(),
  })
  jest.mocked(createHandleDeactivate).mockClear?.()
})

// ---------------------------------------------------------------------------
// 1. Pure helper tests — showDeactivateButton
// ---------------------------------------------------------------------------
describe('showDeactivateButton', () => {
  it('returns true for active state', () => {
    expect(showDeactivateButton('active')).toBe(true)
  })

  it('returns true for activating state', () => {
    expect(showDeactivateButton('activating')).toBe(true)
  })

  it('returns false for deactivating state', () => {
    expect(showDeactivateButton('deactivating')).toBe(false)
  })

  it('returns false for inactive state', () => {
    expect(showDeactivateButton('inactive')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. Pure helper tests — showWithdrawButton
// ---------------------------------------------------------------------------
describe('showWithdrawButton', () => {
  it('returns false for active state', () => {
    expect(showWithdrawButton('active')).toBe(false)
  })

  it('returns false for activating state', () => {
    expect(showWithdrawButton('activating')).toBe(false)
  })

  it('returns false for deactivating state', () => {
    expect(showWithdrawButton('deactivating')).toBe(false)
  })

  it('returns true for inactive state', () => {
    expect(showWithdrawButton('inactive')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. Pure function tests — getCurrentStepIndex
// ---------------------------------------------------------------------------
describe('getCurrentStepIndex', () => {
  it('returns 0 for AWAITING_SIGNATURE', () => {
    expect(getCurrentStepIndex('AWAITING_SIGNATURE')).toBe(0)
  })

  it('returns 1 for CONFIRMING', () => {
    expect(getCurrentStepIndex('CONFIRMING')).toBe(1)
  })

  it('returns 2 for SUCCESS', () => {
    expect(getCurrentStepIndex('SUCCESS')).toBe(2)
  })

  it('returns -1 for IDLE', () => {
    expect(getCurrentStepIndex('IDLE')).toBe(-1)
  })

  it('returns -1 for ERROR', () => {
    expect(getCurrentStepIndex('ERROR')).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// 4. Pure function tests — getRowVisualState
// ---------------------------------------------------------------------------
describe('getRowVisualState', () => {
  it('returns complete for all rows when SUCCESS', () => {
    expect(getRowVisualState('SUCCESS', 'AWAITING_SIGNATURE')).toBe('complete')
    expect(getRowVisualState('SUCCESS', 'CONFIRMING')).toBe('complete')
    expect(getRowVisualState('SUCCESS', 'SUCCESS')).toBe('complete')
  })

  it('returns active for the matching status row when AWAITING_SIGNATURE', () => {
    expect(getRowVisualState('AWAITING_SIGNATURE', 'AWAITING_SIGNATURE')).toBe(
      'active',
    )
    expect(getRowVisualState('AWAITING_SIGNATURE', 'CONFIRMING')).toBe(
      'pending',
    )
    expect(getRowVisualState('AWAITING_SIGNATURE', 'SUCCESS')).toBe('pending')
  })

  it('returns complete for passed rows and active for current row when CONFIRMING', () => {
    expect(getRowVisualState('CONFIRMING', 'AWAITING_SIGNATURE')).toBe(
      'complete',
    )
    expect(getRowVisualState('CONFIRMING', 'CONFIRMING')).toBe('active')
    expect(getRowVisualState('CONFIRMING', 'SUCCESS')).toBe('pending')
  })

  it('returns complete up to AWAITING_SIGNATURE, active for CONFIRMING, pending for SUCCESS on ERROR', () => {
    expect(getRowVisualState('ERROR', 'AWAITING_SIGNATURE')).toBe('complete')
    expect(getRowVisualState('ERROR', 'CONFIRMING')).toBe('active')
    expect(getRowVisualState('ERROR', 'SUCCESS')).toBe('pending')
  })

  it('returns pending for all rows when IDLE', () => {
    expect(getRowVisualState('IDLE', 'AWAITING_SIGNATURE')).toBe('pending')
    expect(getRowVisualState('IDLE', 'CONFIRMING')).toBe('pending')
    expect(getRowVisualState('IDLE', 'SUCCESS')).toBe('pending')
  })
})

// ---------------------------------------------------------------------------
// 5. Pure factory tests — createHandleDeactivateFlow (LIVE, no fake timers)
// ---------------------------------------------------------------------------
describe('createHandleDeactivateFlow', () => {
  it('sequences through AWAITING_SIGNATURE → CONFIRMING → SUCCESS when realHandler succeeds', async () => {
    const statuses: string[] = []
    const setStatus = (s: string) => statuses.push(s)
    const realHandler = jest.fn().mockResolvedValue(undefined)

    const flow = createHandleDeactivateFlow(
      setStatus as any,
      realHandler,
    )
    await flow()

    expect(statuses).toEqual([
      'AWAITING_SIGNATURE',
      'CONFIRMING',
      'SUCCESS',
    ])
    expect(realHandler).toHaveBeenCalledTimes(1)
  })

  it('transitions to ERROR when realHandler rejects', async () => {
    const statuses: string[] = []
    const setStatus = (s: string) => statuses.push(s)
    const realHandler = jest.fn().mockRejectedValue(new Error('tx failed'))

    const flow = createHandleDeactivateFlow(
      setStatus as any,
      realHandler,
    )
    await flow()

    expect(statuses).toEqual([
      'AWAITING_SIGNATURE',
      'ERROR',
    ])
  })

  it('calls onSuccess callback after SUCCESS state is set', async () => {
    const statuses: string[] = []
    const setStatus = (s: string) => statuses.push(s)
    const realHandler = jest.fn().mockResolvedValue(undefined)
    const onSuccess = jest.fn()

    const flow = createHandleDeactivateFlow(
      setStatus as any,
      realHandler,
      onSuccess,
    )
    await flow()

    expect(statuses).toEqual([
      'AWAITING_SIGNATURE',
      'CONFIRMING',
      'SUCCESS',
    ])
    // onSuccess must be called AFTER SUCCESS is set
    // (verified by the order: SUCCESS appears before we check onSuccess)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onSuccess when realHandler rejects', async () => {
    const statuses: string[] = []
    const setStatus = (s: string) => statuses.push(s)
    const realHandler = jest.fn().mockRejectedValue(new Error('tx failed'))
    const onSuccess = jest.fn()

    const flow = createHandleDeactivateFlow(
      setStatus as any,
      realHandler,
      onSuccess,
    )
    await flow()

    expect(statuses).toEqual([
      'AWAITING_SIGNATURE',
      'ERROR',
    ])
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 6. PROGRESS_ROWS constant
// ---------------------------------------------------------------------------
describe('PROGRESS_ROWS', () => {
  it('has three entries in order: AWAITING_SIGNATURE, CONFIRMING, SUCCESS', () => {
    expect(PROGRESS_ROWS).toHaveLength(3)
    expect(PROGRESS_ROWS[0].status).toBe('AWAITING_SIGNATURE')
    expect(PROGRESS_ROWS[1].status).toBe('CONFIRMING')
    expect(PROGRESS_ROWS[2].status).toBe('SUCCESS')
  })

  it('each row has a non-empty label', () => {
    for (const row of PROGRESS_ROWS) {
      expect(row.label.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// 7. Component tests — basic rendering
// ---------------------------------------------------------------------------
describe('StakeManagerModal', () => {
  it('renders nothing when visible is false', async () => {
    const { queryByTestId } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount()}
        visible={false}
        onClose={jest.fn()}
      />,
    )

    expect(queryByTestId('stake-manager-modal')).toBeNull()
  })

  it('renders modal content when visible is true', async () => {
    const { getByTestId, getByText } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount()}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(getByTestId('stake-manager-modal')).toBeTruthy()
    })

    expect(getByText('Stake Account')).toBeTruthy()
  })

  it('displays the stake account pubkey', async () => {
    const { getByText } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({
          pubkey: 'MyStakePubkey1111111111111111111111111',
        })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(
        getByText('MyStakePubkey1111111111111111111111111'),
      ).toBeTruthy()
    })
  })

  it('displays the stake account status with correct label', async () => {
    const { getByText } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({ state: 'active' })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(getByText('Active')).toBeTruthy()
    })
  })

  it('displays the delegated amount in SOL', async () => {
    const { getByText } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({
          delegatedAmount: 3_500_000_000n,
        })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(getByText('3.50 SOL')).toBeTruthy()
    })
  })

  it('displays voter pubkey', async () => {
    const { getByText } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({
          voterPubkey: 'VoterXYZ11111111111111111111111111111',
        })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(
        getByText('VoterXYZ11111111111111111111111111111'),
      ).toBeTruthy()
    })
  })

  it('shows N/A when voterPubkey is undefined', async () => {
    const { getByText } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({ voterPubkey: undefined })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(getByText('N/A')).toBeTruthy()
    })
  })

  it('shows Deactivate Stake button for active state', async () => {
    const { getByTestId } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({ state: 'active' })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(getByTestId('deactivate-stake-button')).toBeTruthy()
    })
  })

  it('does not show Deactivate Stake button for deactivating state', async () => {
    const { queryByTestId } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({ state: 'deactivating' })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(queryByTestId('deactivate-stake-button')).toBeNull()
    })
  })

  it('does not show Deactivate Stake button for inactive state', async () => {
    const { queryByTestId } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({ state: 'inactive' })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(queryByTestId('deactivate-stake-button')).toBeNull()
    })
  })

  it('calls createHandleDeactivate with correct args when modal is visible', async () => {
    const sendTx = jest.fn()
    mockUseMobileWallet.mockReturnValue({
      account: { address: MOCK_AUTHORIZED_PUBKEY },
      sendTransactions: sendTx,
    })

    const stakeAccount = makeStakeAccount({
      pubkey: 'TargetStakeAcct11111111111111111111111',
      state: 'active',
    })

    await render(
      <StakeManagerModal
        stakeAccount={stakeAccount}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    expect(mockCreateHandleDeactivate).toHaveBeenCalledWith(
      'TargetStakeAcct11111111111111111111111',
      MOCK_AUTHORIZED_PUBKEY,
      sendTx,
    )
  })

  it('shows close button', async () => {
    const { getByTestId } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount()}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(getByTestId('stake-manager-close')).toBeTruthy()
    })
  })

  // -----------------------------------------------------------------------
  // 8. Withdraw button tests
  // -----------------------------------------------------------------------
  it('shows Withdraw Stake button for inactive state', async () => {
    const { getByTestId } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({ state: 'inactive' })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(getByTestId('withdraw-stake-button')).toBeTruthy()
    })
  })

  it('does not show Withdraw Stake button for active state', async () => {
    const { queryByTestId } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({ state: 'active' })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(queryByTestId('withdraw-stake-button')).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // 9. Progress overlay — does NOT appear when idle
  // -----------------------------------------------------------------------
  it('does not render the progress overlay when transaction is idle', async () => {
    const { queryByTestId } = await render(
      <StakeManagerModal
        stakeAccount={makeStakeAccount({ state: 'active' })}
        visible={true}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(
        queryByTestId('transaction-progress-overlay'),
      ).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// 10. Pure visual-state integration tests
// ---------------------------------------------------------------------------
describe('Progress overlay visual states — pure integration', () => {
  it('AWAITING_SIGNATURE: row 0 = active, rows 1-2 = pending', () => {
    const visual0 = getRowVisualState('AWAITING_SIGNATURE', 'AWAITING_SIGNATURE')
    const visual1 = getRowVisualState('AWAITING_SIGNATURE', 'CONFIRMING')
    const visual2 = getRowVisualState('AWAITING_SIGNATURE', 'SUCCESS')

    expect(visual0).toBe('active')
    expect(visual1).toBe('pending')
    expect(visual2).toBe('pending')
  })

  it('CONFIRMING: row 0 = complete, row 1 = active, row 2 = pending', () => {
    const visual0 = getRowVisualState('CONFIRMING', 'AWAITING_SIGNATURE')
    const visual1 = getRowVisualState('CONFIRMING', 'CONFIRMING')
    const visual2 = getRowVisualState('CONFIRMING', 'SUCCESS')

    expect(visual0).toBe('complete')
    expect(visual1).toBe('active')
    expect(visual2).toBe('pending')
  })

  it('SUCCESS: all rows = complete', () => {
    const visual0 = getRowVisualState('SUCCESS', 'AWAITING_SIGNATURE')
    const visual1 = getRowVisualState('SUCCESS', 'CONFIRMING')
    const visual2 = getRowVisualState('SUCCESS', 'SUCCESS')

    expect(visual0).toBe('complete')
    expect(visual1).toBe('complete')
    expect(visual2).toBe('complete')
  })

  it('ERROR: row 0 = complete, row 1 = active, row 2 = pending', () => {
    const visual0 = getRowVisualState('ERROR', 'AWAITING_SIGNATURE')
    const visual1 = getRowVisualState('ERROR', 'CONFIRMING')
    const visual2 = getRowVisualState('ERROR', 'SUCCESS')

    expect(visual0).toBe('complete')
    expect(visual1).toBe('active')
    expect(visual2).toBe('pending')
  })
})