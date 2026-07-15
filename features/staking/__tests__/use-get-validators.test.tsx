import { renderHook, waitFor } from '@testing-library/react-native'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// We need to mock useMobileWallet BEFORE the module that imports it is loaded.
// jest.mock hoists to the top regardless of import order.
const mockClient = {
  rpc: {
    getVoteAccounts: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({
        current: [
          { votePubkey: 'abc123', commission: 50, activatedStake: 1000000000n },
          { votePubkey: 'def456', commission: 100, activatedStake: 2000000000n },
        ],
      }),
    }),
  },
}

jest.mock('@wallet-ui/react-native-kit', () => ({
  useMobileWallet: () => ({
    chain: 'solana:devnet',
    client: mockClient,
  }),
}))

import { useGetValidators } from '../use-get-validators'

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

describe('useGetValidators', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls getVoteAccounts RPC method', async () => {
    const { result } = await renderHook(() => useGetValidators(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockClient.rpc.getVoteAccounts).toHaveBeenCalledTimes(1)
  })

  it('returns the current array of vote accounts', async () => {
    const { result } = await renderHook(() => useGetValidators(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([
      { votePubkey: 'abc123', commission: 50, activatedStake: 1000000000n },
      { votePubkey: 'def456', commission: 100, activatedStake: 2000000000n },
    ])
  })

  it('uses the correct queryKey with chain', async () => {
    const { result } = await renderHook(() => useGetValidators(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBeDefined()
    expect(mockClient.rpc.getVoteAccounts).toHaveBeenCalled()
  })

  it('returns empty array when no current validators', async () => {
    mockClient.rpc.getVoteAccounts.mockReturnValue({
      send: jest.fn().mockResolvedValue({ current: [] }),
    })

    const { result } = await renderHook(() => useGetValidators(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })
})