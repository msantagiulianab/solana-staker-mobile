/**
 * Tests for PortfolioDashboard component.
 *
 * Mock strategy: mock useGetStakeAccounts inline.
 * The component accepts an { address: string } prop and renders a FlatList
 * of StakeAccountInfo cards with delegatedAmount (SOL), state badge, and
 * truncated pubkey.
 *
 * Pure helpers getStakeStateColor and STAKE_STATE_LABELS are tested
 * directly without rendering.
 */

import { render, waitFor } from '@testing-library/react-native'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const MOCK_ADDRESS = 'Staker111111111111111111111111111111111111'

const mockStakeAccounts = [
  {
    pubkey: 'StakeAcct111111111111111111111111111111111',
    lamports: 2_500_000_000n,
    state: 'active' as const,
    voterPubkey: 'Vote111111111111111111111111111111111111111',
    delegatedAmount: 1_500_000_000n,
  },
  {
    pubkey: 'StakeAcct222222222222222222222222222222222',
    lamports: 2_500_000_000n,
    state: 'activating' as const,
    voterPubkey: 'Vote222222222222222222222222222222222222222',
    delegatedAmount: 2_000_000_000n,
  },
  {
    pubkey: 'StakeAcct333333333333333333333333333333333',
    lamports: 2_500_000_000n,
    state: 'deactivating' as const,
    voterPubkey: 'Vote333333333333333333333333333333333333333',
    delegatedAmount: 500_000_000n,
  },
  {
    pubkey: 'StakeAcct444444444444444444444444444444444',
    lamports: 2_500_000_000n,
    state: 'inactive' as const,
    voterPubkey: undefined,
    delegatedAmount: undefined,
  },
]

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockUseGetStakeAccounts = jest.fn()

jest.mock('@/features/staking/use-get-stake-accounts', () => ({
  useGetStakeAccounts: (args: any) => mockUseGetStakeAccounts(args),
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

// Dynamic import after mocks
import { PortfolioDashboard, getStakeStateColor, STAKE_STATE_LABELS } from '../PortfolioDashboard'
import type { StakeAccountInfo } from '../use-get-stake-accounts'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockUseGetStakeAccounts.mockReset()
  mockUseGetStakeAccounts.mockReturnValue({
    data: mockStakeAccounts,
    isLoading: false,
    isError: false,
    isSuccess: true,
  })
})

// ---------------------------------------------------------------------------
// 1. Pure helper tests (no rendering needed)
// ---------------------------------------------------------------------------
describe('getStakeStateColor', () => {
  it('returns green for active', () => {
    expect(getStakeStateColor('active')).toBe('#4CAF50')
  })

  it('returns orange for activating', () => {
    expect(getStakeStateColor('activating')).toBe('#FF9800')
  })

  it('returns red for deactivating', () => {
    expect(getStakeStateColor('deactivating')).toBe('#F44336')
  })

  it('returns gray for inactive', () => {
    expect(getStakeStateColor('inactive')).toBe('#9E9E9E')
  })
})

describe('STAKE_STATE_LABELS', () => {
  it('has human-readable labels for all states', () => {
    expect(STAKE_STATE_LABELS.active).toBe('Active')
    expect(STAKE_STATE_LABELS.activating).toBe('Activating')
    expect(STAKE_STATE_LABELS.deactivating).toBe('Deactivating')
    expect(STAKE_STATE_LABELS.inactive).toBe('Inactive')
  })
})

// ---------------------------------------------------------------------------
// 2. Component tests
// ---------------------------------------------------------------------------
describe('PortfolioDashboard', () => {
  it('passes the address to useGetStakeAccounts', async () => {
    await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    expect(mockUseGetStakeAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ address: MOCK_ADDRESS }),
    )
  })

  it('renders loading indicator when isLoading is true', async () => {
    mockUseGetStakeAccounts.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
    })

    const { getByText } = await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    expect(getByText('Loading stake accounts...')).toBeTruthy()
  })

  it('renders error message when isError is true', async () => {
    mockUseGetStakeAccounts.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
    })

    const { getByText } = await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    expect(getByText('Failed to load stake accounts.')).toBeTruthy()
  })

  it('renders empty state when data is an empty array', async () => {
    mockUseGetStakeAccounts.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isSuccess: true,
    })

    const { getByText } = await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    expect(getByText('No stake accounts found.')).toBeTruthy()
  })

  it('renders stake account cards with delegated amount in SOL', async () => {
    const { getByText } = await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    await waitFor(() => {
      // Account 1: 1.5 SOL delegated
      expect(getByText('1.50 SOL')).toBeTruthy()
      // Account 2: 2.0 SOL delegated
      expect(getByText('2.00 SOL')).toBeTruthy()
    })
  })

  it('renders stake account cards with state badges', async () => {
    const { getByText } = await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    await waitFor(() => {
      expect(getByText('Active')).toBeTruthy()
      expect(getByText('Activating')).toBeTruthy()
      expect(getByText('Deactivating')).toBeTruthy()
      expect(getByText('Inactive')).toBeTruthy()
    })
  })

  it('renders truncated pubkeys for each account', async () => {
    const { getByText } = await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    await waitFor(() => {
      // ellipsify with defaults: 4 chars prefix, 4 chars suffix
      expect(getByText('Stak..1111')).toBeTruthy()
      expect(getByText('Stak..2222')).toBeTruthy()
    })
  })

  it('shows "N/A" for delegatedAmount when undefined', async () => {
    const { getByText } = await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    await waitFor(() => {
      // Account 4 (inactive) has undefined delegatedAmount
      expect(getByText('N/A')).toBeTruthy()
    })
  })

  it('renders title header', async () => {
    const { getByText } = await render(<PortfolioDashboard address={MOCK_ADDRESS} />)

    expect(getByText('Your Stake Accounts')).toBeTruthy()
  })
})