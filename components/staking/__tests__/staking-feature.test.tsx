import { render, waitFor } from '@testing-library/react-native'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockValidators = [
  { votePubkey: 'abc123', commission: 50, activatedStake: 1000000000n },
  { votePubkey: 'def456', commission: 100, activatedStake: 2000000000n },
]

const mockUseGetValidators = jest.fn()

jest.mock('@/features/staking/use-get-validators', () => ({
  useGetValidators: () => mockUseGetValidators(),
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

import { StakingFeature } from '@/components/staking/staking-feature'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('StakingFeature', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('happy path', () => {
    beforeEach(() => {
      mockUseGetValidators.mockReturnValue({
        data: mockValidators,
        isLoading: false,
        isError: false,
        isSuccess: true,
      })
    })

    it('renders the staking title', async () => {
      const { getByText } = await render(<StakingFeature />, { wrapper: createWrapper() })
      await waitFor(() => expect(getByText('Staking')).toBeTruthy())
    })

    it('renders validator votePubkeys from useGetValidators', async () => {
      const { getByText } = await render(<StakingFeature />, { wrapper: createWrapper() })
      await waitFor(() => expect(getByText('Vote Key: abc123')).toBeTruthy())
      expect(getByText('Vote Key: def456')).toBeTruthy()
    })

    it('renders validator commissions', async () => {
      const { getByText } = await render(<StakingFeature />, { wrapper: createWrapper() })
      await waitFor(() => expect(getByText('Commission: 50%')).toBeTruthy())
      expect(getByText('Commission: 100%')).toBeTruthy()
    })
  })

  describe('loading state', () => {
    beforeEach(() => {
      mockUseGetValidators.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        isSuccess: false,
      })
    })

    it('shows loading message while fetching', async () => {
      const { getByText } = await render(<StakingFeature />, { wrapper: createWrapper() })
      await waitFor(() => expect(getByText('Loading validators...')).toBeTruthy())
    })
  })

  describe('error state', () => {
    beforeEach(() => {
      mockUseGetValidators.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        isSuccess: false,
      })
    })

    it('shows error message on fetch failure', async () => {
      const { getByText } = await render(<StakingFeature />, { wrapper: createWrapper() })
      await waitFor(() => expect(getByText('Failed to load validators.')).toBeTruthy())
    })
  })
})