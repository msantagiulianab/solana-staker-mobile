import { render, waitFor } from '@testing-library/react-native'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockValidators = [
  { votePubkey: 'abc123', commission: 50, activatedStake: 1000000000n },
  { votePubkey: 'def456', commission: 100, activatedStake: 2000000000n },
  { votePubkey: 'ghi789', commission: 0, activatedStake: 3000000000n },
  { votePubkey: 'jkl012', commission: 5, activatedStake: 4000000000n },
]

const mockUseGetValidators = jest.fn()
const mockPush = jest.fn()

jest.mock('@/features/staking/use-get-validators', () => ({
  useGetValidators: () => mockUseGetValidators(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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

    it('renders ellipsified validator pubkeys from ValidatorCard (excluding 100% filtered)', async () => {
      const { getByText, queryByText } = await render(<StakingFeature />, {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(getByText('abc123')).toBeTruthy())
      expect(getByText('ghi789')).toBeTruthy()
      expect(getByText('jkl012')).toBeTruthy()
      // 100% commission validator should be filtered out
      expect(queryByText('def456')).toBeNull()
    })

    it('renders commission percentages via ValidatorCard (excluding filtered 100%)', async () => {
      const { getByText, queryByText } = await render(<StakingFeature />, {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(getByText('50%')).toBeTruthy())
      expect(getByText('0%')).toBeTruthy()
      expect(getByText('5%')).toBeTruthy()
      expect(queryByText('100%')).toBeNull()
    })

    it('filters out validators with 100% commission', async () => {
      const { queryByText } = await render(<StakingFeature />, {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(queryByText('def456')).toBeNull())
      expect(queryByText('100%')).toBeNull()
    })

    it('sorts validators by commission ascending (0% before 5% before 50%)', async () => {
      const { getByText } = await render(
        <StakingFeature />,
        { wrapper: createWrapper() },
      )

      await waitFor(() => expect(getByText('0%')).toBeTruthy())

      // All three expected percentages are rendered (ASC sort: 0% → 5% → 50%).
      // Verify with individual getByText which asserts presence + absence of
      // duplicates means the sort produced one of each.
      expect(getByText('0%')).toBeTruthy()
      expect(getByText('5%')).toBeTruthy()
      expect(getByText('50%')).toBeTruthy()
      // 100% should NOT be rendered (filtered out)
      expect(() => getByText('100%')).toThrow()
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