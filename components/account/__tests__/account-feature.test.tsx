/**
 * Tests for AccountFeature component.
 *
 * Covers:
 * - Disconnected state: renders "Connect your wallet." + connect button
 * - Connected state: renders balance, address, StakingFeature, token accounts,
 *   and PortfolioDashboard.
 */

import { render, waitFor } from '@testing-library/react-native'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const MOCK_ADDRESS = 'Deployer111111111111111111111111111111111'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockUseMobileWallet = jest.fn()

jest.mock('@wallet-ui/react-native-kit', () => ({
  useMobileWallet: () => mockUseMobileWallet(),
}))

const mockUseGetBalance = jest.fn()

jest.mock('@/components/account/use-get-balance', () => ({
  useGetBalance: (args: any) => mockUseGetBalance(args),
}))

const mockUseGetTokenAccounts = jest.fn()

jest.mock('@/components/account/use-get-token-accounts', () => ({
  useGetTokenAccounts: (args: any) => mockUseGetTokenAccounts(args),
}))

// Mock PortfolioDashboard with a testID-identifiable wrapper
jest.mock('@/features/staking/PortfolioDashboard', () => {
  const React = require('react')
  const MockPortfolioDashboard = ({ address }: { address: string }) =>
    React.createElement('View', { testID: 'portfolio-dashboard-mock' }, null)
  MockPortfolioDashboard.displayName = 'PortfolioDashboard'
  return { PortfolioDashboard: MockPortfolioDashboard }
})

// Mock react-query to provide useQueryClient
const mockInvalidateQueries = jest.fn()

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  }
})

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

// Dynamic import after all mocks are hoisted
import { AccountFeature } from '../account-feature'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.mocked(mockUseMobileWallet).mockReset()
  jest.mocked(mockUseGetBalance).mockReset()
  jest.mocked(mockUseGetTokenAccounts).mockReset()
  jest.mocked(mockInvalidateQueries).mockClear()
})

// ---------------------------------------------------------------------------
// 1. Disconnected state
// ---------------------------------------------------------------------------
describe('AccountFeature — disconnected', () => {
  beforeEach(() => {
    mockUseMobileWallet.mockReturnValue({ account: null })
  })

  it('renders the connect prompt text', async () => {
    const { getByText } = await render(<AccountFeature />)

    expect(getByText('Connect your wallet.')).toBeTruthy()
  })

  it('renders the connect button', async () => {
    const { getByText } = await render(<AccountFeature />)

    // WalletUiButtonConnect renders "Connect" text
    expect(getByText('Connect')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 2. Connected state
// ---------------------------------------------------------------------------
describe('AccountFeature — connected', () => {
  beforeEach(() => {
    mockUseMobileWallet.mockReturnValue({
      account: { address: MOCK_ADDRESS },
    })
    mockUseGetBalance.mockReturnValue({
      data: 1_500_000_000n,
      isLoading: false,
    })
    mockUseGetTokenAccounts.mockReturnValue({
      data: [],
      isLoading: false,
    })
  })

  it('passes the address to useGetBalance', async () => {
    await render(<AccountFeature />)

    expect(mockUseGetBalance).toHaveBeenCalledWith(
      expect.objectContaining({ address: MOCK_ADDRESS }),
    )
  })

  it('passes the address to useGetTokenAccounts', async () => {
    await render(<AccountFeature />)

    expect(mockUseGetTokenAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ address: MOCK_ADDRESS }),
    )
  })

  it('renders the account address via ellipsify', async () => {
    const { getByText } = await render(<AccountFeature />)

    // Address is passed through ellipsify: 4+4 chars with ".." separator
    expect(getByText('Depl..1111')).toBeTruthy()
  })

  it('renders the portfolio dashboard', async () => {
    const { getByTestId } = await render(<AccountFeature />)

    expect(getByTestId('portfolio-dashboard-mock')).toBeTruthy()
  })

  it('renders the "Actions" card', async () => {
    const { getByText } = await render(<AccountFeature />)

    expect(getByText('Actions')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 3. Connected state — token accounts present
// ---------------------------------------------------------------------------
describe('AccountFeature — connected with token accounts', () => {
  const mockTokens = [
    {
      pubkey: 'TokenAcct11111111111111111111111111111111',
      account: {
        data: {
          parsed: {
            info: {
              mint: 'Mint111111111111111111111111111111111111',
              tokenAmount: {
                uiAmount: 42.5,
              },
            },
          },
        },
      },
    },
  ]

  beforeEach(() => {
    mockUseMobileWallet.mockReturnValue({
      account: { address: MOCK_ADDRESS },
    })
    mockUseGetBalance.mockReturnValue({
      data: 1_500_000_000n,
      isLoading: false,
    })
    mockUseGetTokenAccounts.mockReturnValue({
      data: mockTokens,
      isLoading: false,
    })
  })

  it('renders token account entry when tokens exist', async () => {
    const { queryByText } = await render(<AccountFeature />)

    await waitFor(() => {
      // Token account pubkey ellipsified — use a regex that matches across
      // composite text nodes (RNTL nests children inside a single <Text>)
      expect(queryByText(/Toke\.\.1111/)).toBeTruthy()
      // UI amount displayed
      expect(queryByText(/42\.5/)).toBeTruthy()
    })
  })

  it('renders the "Token Accounts" subtitle', async () => {
    const { getByText } = await render(<AccountFeature />)

    expect(getByText('Token Accounts')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 4. Connected state — no token accounts
// ---------------------------------------------------------------------------
describe('AccountFeature — connected, no tokens', () => {
  beforeEach(() => {
    mockUseMobileWallet.mockReturnValue({
      account: { address: MOCK_ADDRESS },
    })
    mockUseGetBalance.mockReturnValue({
      data: 1_500_000_000n,
      isLoading: false,
    })
    mockUseGetTokenAccounts.mockReturnValue({
      data: [],
      isLoading: false,
    })
  })

  it('renders "No token accounts found." message', async () => {
    const { getByText } = await render(<AccountFeature />)

    expect(getByText('No token accounts found.')).toBeTruthy()
  })
})