/**
 * Tests for StakeManagerModal component.
 *
 * Architecture:
 *   - Receives stakeAccount, visible, onClose props
 *   - Displays stake account details (pubkey, status, delegated amount, voter)
 *   - Wires a "Deactivate Stake" button to createHandleDeactivate factory
 *   - Only shows deactivate button for 'active' and 'activating' states
 *   - Uses useMobileWallet for authorizedPubkey and sendTransactions
 *
 * Mock strategy:
 *   - Inline mocks for useMobileWallet, createHandleDeactivate
 *   - Pure helpers (showDeactivateButton) tested without rendering
 */

import { render, waitFor } from '@testing-library/react-native'
import React from 'react'
import { Alert } from 'react-native'
import type { StakeAccountInfo } from '@/features/staking/use-get-stake-accounts'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockCreateHandleDeactivate = jest.fn()

jest.mock('@/features/staking/deactivate-stake', () => ({
  createHandleDeactivate: (a: any, b: any, c: any) =>
    mockCreateHandleDeactivate(a, b, c),
}))

const mockUseMobileWallet = jest.fn()

jest.mock('@wallet-ui/react-native-kit', () => ({
  useMobileWallet: () => mockUseMobileWallet(),
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

jest.mock('@/features/staking/PortfolioDashboard', () => ({
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
  mockUseMobileWallet.mockReset()
  mockUseMobileWallet.mockReturnValue({
    account: { address: MOCK_AUTHORIZED_PUBKEY },
    sendTransactions: jest.fn(),
  })
  jest.mocked(createHandleDeactivate).mockClear?.()
})

// ---------------------------------------------------------------------------
// 1. Pure helper tests
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
// 2. Component tests
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

    // Title
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
      // 3.5 SOL
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
})