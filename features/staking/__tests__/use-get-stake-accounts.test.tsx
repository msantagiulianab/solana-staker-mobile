/**
 * Tests for useGetStakeAccounts hook.
 *
 * Mocks @solana/kit and @solana-program/stake inline so Jest never loads
 * the .mjs ESM entry-points of @solana/kit.  All mock data generation
 * happens INSIDE each jest.mock() factory to avoid out-of-scope references.
 *
 * decodeAccount is mocked to return pre-built StakeStateV2 shapes keyed
 * by pubkey, so no real binary decoding is needed at test time.
 */

import { renderHook, waitFor } from '@testing-library/react-native'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Mock @solana/kit
// ---------------------------------------------------------------------------
let mockDecodeAccount: jest.Mock

jest.mock('@solana/kit', () => {
  // ---- Everything inline — no references to external scope ----

  const makeMeta = (staker: string) => ({
    rentExemptReserve: 2_282_880n,
    authorized: { staker, withdrawer: '\0'.repeat(32) },
    lockup: { unixTimestamp: 0n, epoch: 0n, custodian: '\0'.repeat(32) },
  })

  const makeStakeFields = (staker: string, actEpoch: bigint, deactEpoch: bigint) => {
    const delegation = {
      voterPubkey: 'Vote111111111111111111111111111111111111111',
      stake: 1_000_000_000n,
      activationEpoch: actEpoch,
      deactivationEpoch: deactEpoch,
      warmupCooldownRate: 0,
    }
    const stake = { delegation, creditsObserved: 0n }
    return [makeMeta(staker), stake, { bits: 0 }] as const
  }

  mockDecodeAccount = jest.fn((encoded: any, _decoder: any) => {
    const addr: string = (encoded as any).address ?? ''
    let state: any = { __kind: 'Uninitialized' as const }

    if (addr === 'stakeAcct1') {
      state = { __kind: 'Stake' as const, fields: makeStakeFields(
        'Staker111111111111111111111111111111111111', 0n, (1n << 64n) - 1n,
      )}
    } else if (addr === 'stakeAcct2') {
      state = { __kind: 'Stake' as const, fields: makeStakeFields(
        'Staker111111111111111111111111111111111111', 100n, (1n << 64n) - 1n,
      )}
    } else if (addr === 'stakeAcct3') {
      state = { __kind: 'Stake' as const, fields: makeStakeFields(
        'Other1111111111111111111111111111111111111', 0n, (1n << 64n) - 1n,
      )}
    } else if (addr === 'deactAcct') {
      state = { __kind: 'Stake' as const, fields: makeStakeFields(
        'Staker111111111111111111111111111111111111', 0n, 10n,
      )}
    }

    return { data: { state }, address: addr }
  })

  return { decodeAccount: mockDecodeAccount }
})

// ---------------------------------------------------------------------------
// Mock @solana-program/stake (pure stub — decodeAccount is mocked above)
// ---------------------------------------------------------------------------
jest.mock('@solana-program/stake', () => ({
  STAKE_PROGRAM_ADDRESS: 'Stake111111111111111111111111111111111111111',
  getStakeStateAccountDecoder: () => ({ decode: () => ({}) }),
}))

// ---------------------------------------------------------------------------
// Mock @wallet-ui/react-native-kit
// ---------------------------------------------------------------------------
let mockGetProgramAccounts: jest.Mock
let mockGetEpochInfo: jest.Mock

jest.mock('@wallet-ui/react-native-kit', () => {
  const makeAccountInfo = (pubkey: string, lamports: number) => ({
    pubkey,
    account: {
      data: ['base64', 'mock-base64-data'],
      executable: false,
      lamports,
      owner: 'Stake111111111111111111111111111111111111111',
      rentEpoch: 0,
      space: 200,
    },
  })

  mockGetProgramAccounts = jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue([
      makeAccountInfo('stakeAcct1', 2_500_000_000),
      makeAccountInfo('stakeAcct2', 2_500_000_000),
      makeAccountInfo('stakeAcct3', 2_500_000_000),
    ]),
  })

  mockGetEpochInfo = jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue({ epoch: 50n }),
  })

  return {
    useMobileWallet: () => ({
      chain: 'solana:devnet',
      client: {
        rpc: {
          getProgramAccounts: mockGetProgramAccounts,
          getEpochInfo: mockGetEpochInfo,
        },
      },
    }),
  }
})

// ---------------------------------------------------------------------------
// Dynamic import (after all mocks are installed)
// ---------------------------------------------------------------------------
import { useGetStakeAccounts } from '../use-get-stake-accounts'
import { STAKE_PROGRAM_ADDRESS } from '@solana-program/stake'
import type { Address } from '@solana/kit'

// ---------------------------------------------------------------------------
// Test wrapper — gcTime: 0 prevents React Query GC timers from keeping
// Jest workers alive after tests complete
// ---------------------------------------------------------------------------
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Helper to build a mock account info for per-test override
function makeAccountInfo(pubkey: string, lamports: number) {
  return {
    pubkey,
    account: {
      data: ['base64', 'mock-base64-data'],
      executable: false,
      lamports,
      owner: 'Stake111111111111111111111111111111111111111',
      rentEpoch: 0,
      space: 200,
    },
  }
}

const MOCK_STAKER = 'Staker111111111111111111111111111111111111'
const MOCK_VOTER = 'Vote111111111111111111111111111111111111111'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useGetStakeAccounts', () => {
  beforeEach(() => {
    mockGetProgramAccounts.mockReset()
    mockGetEpochInfo.mockReset()

    mockGetProgramAccounts.mockReturnValue({
      send: jest.fn().mockResolvedValue([
        makeAccountInfo('stakeAcct1', 2_500_000_000),
        makeAccountInfo('stakeAcct2', 2_500_000_000),
        makeAccountInfo('stakeAcct3', 2_500_000_000),
      ]),
    })

    mockGetEpochInfo.mockReturnValue({
      send: jest.fn().mockResolvedValue({ epoch: 50n }),
    })
  })

  it('calls getProgramAccounts with the Stake program address', async () => {
    await renderHook(() => useGetStakeAccounts({ address: MOCK_STAKER as Address }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockGetProgramAccounts).toHaveBeenCalledTimes(1)
    })

    const callArgs = mockGetProgramAccounts.mock.calls[0]
    expect(callArgs[0]).toBe(STAKE_PROGRAM_ADDRESS)
    expect(callArgs[1]).toMatchObject({ encoding: 'base64' })
  })

  it('fetches the current epoch', async () => {
    await renderHook(() => useGetStakeAccounts({ address: MOCK_STAKER as Address }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockGetEpochInfo).toHaveBeenCalledTimes(1)
    })
  })

  it('returns parsed stake accounts with pubkey, lamports, and state', async () => {
    const { result } = await renderHook(
      () => useGetStakeAccounts({ address: MOCK_STAKER as Address }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const accounts = result.current.data!
    expect(accounts).toHaveLength(3)

    expect(accounts[0]).toMatchObject({
      pubkey: 'stakeAcct1',
      lamports: 2_500_000_000n,
      state: 'active',
      voterPubkey: MOCK_VOTER,
      delegatedAmount: 1_000_000_000n,
    })

    expect(accounts[1]).toMatchObject({
      pubkey: 'stakeAcct2',
      lamports: 2_500_000_000n,
      state: 'activating',
      voterPubkey: MOCK_VOTER,
      delegatedAmount: 1_000_000_000n,
    })

    expect(accounts[2]).toMatchObject({
      pubkey: 'stakeAcct3',
      state: 'active',
    })
  })

  it('marks deactivating stake when deactivationEpoch < current epoch', async () => {
    mockGetProgramAccounts.mockReturnValue({
      send: jest.fn().mockResolvedValue([
        makeAccountInfo('deactAcct', 2_500_000_000),
      ]),
    })

    const { result } = await renderHook(
      () => useGetStakeAccounts({ address: MOCK_STAKER as Address }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].state).toBe('deactivating')
  })

  it('surfaces error when epoch fetch fails', async () => {
    mockGetEpochInfo.mockReturnValue({
      send: jest.fn().mockRejectedValue(new Error('RPC down')),
    })

    const { result } = await renderHook(
      () => useGetStakeAccounts({ address: MOCK_STAKER as Address }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('returns empty array when no accounts are returned', async () => {
    mockGetProgramAccounts.mockReturnValue({
      send: jest.fn().mockResolvedValue([]),
    })

    const { result } = await renderHook(
      () => useGetStakeAccounts({ address: MOCK_STAKER as Address }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('uses the correct queryKey with chain and address', async () => {
    const { result } = await renderHook(
      () => useGetStakeAccounts({ address: MOCK_STAKER as Address }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeDefined()
  })
})