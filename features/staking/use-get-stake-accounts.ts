import { useQuery } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import type { Address } from '@solana/kit'
import {
  STAKE_PROGRAM_ADDRESS,
  getStakeStateAccountDecoder,
  type StakeStateV2,
} from '@solana-program/stake'
import { decodeAccount } from '@solana/kit'

// ---------------------------------------------------------------------------
// Public return type
// ---------------------------------------------------------------------------

export type StakeAccountInfo = {
  pubkey: string
  lamports: bigint
  state: 'active' | 'activating' | 'deactivating' | 'inactive'
  voterPubkey: string | undefined
  delegatedAmount: bigint | undefined
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const U64_MAX = (1n << 64n) - 1n

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

function base64ToUint8Array(base64: string): Uint8Array {
  // Use Buffer for React Native / Node compatibility
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

export function deriveStakeState(stakeStateV2: StakeStateV2, currentEpoch: bigint): StakeAccountInfo['state'] {
  if (stakeStateV2.__kind !== 'Stake') {
    return 'inactive'
  }

  const [, stake] = stakeStateV2.fields
  const { activationEpoch, deactivationEpoch } = stake.delegation

  if (deactivationEpoch !== U64_MAX && deactivationEpoch <= currentEpoch) {
    return 'deactivating'
  }

  if (activationEpoch > currentEpoch) {
    return 'activating'
  }

  // activationEpoch <= currentEpoch && deactivationEpoch == U64_MAX
  return 'active'
}

export function extractVoterAndStake(
  stakeStateV2: StakeStateV2,
): { voterPubkey: string | undefined; delegatedAmount: bigint | undefined } {
  if (stakeStateV2.__kind !== 'Stake') {
    return { voterPubkey: undefined, delegatedAmount: undefined }
  }
  const [, stake] = stakeStateV2.fields
  return {
    voterPubkey: stake.delegation.voterPubkey as unknown as string,
    delegatedAmount: stake.delegation.stake,
  }
}

export function parseStakeAccount(
  raw: { pubkey: string; account: { lamports: number; data: [string, string]; owner: string; executable: boolean; rentEpoch: number; space: number } },
  currentEpoch: bigint,
): StakeAccountInfo | null {
  // decodeAccount expects Branded nominal types (Lamports, Address).
  // We construct the encoded object using `as any` to satisfy the encoder's
  // runtime expectations — at runtime these are plain bigint/string values.
  const encoded = {
    address: raw.pubkey,
    data: base64ToUint8Array(raw.account.data[1]),
    executable: raw.account.executable,
    lamports: BigInt(raw.account.lamports),
    programAddress: raw.account.owner,
    space: BigInt(raw.account.space),
  } as any

  try {
    const decoded = decodeAccount(encoded, getStakeStateAccountDecoder())
    const stakeStateV2 = decoded.data.state

    return {
      pubkey: raw.pubkey,
      lamports: BigInt(raw.account.lamports),
      state: deriveStakeState(stakeStateV2, currentEpoch),
      ...extractVoterAndStake(stakeStateV2),
    }
  } catch (error) {
    console.warn(`⚠️ [STAKE DECODE] Failed to decode account ${raw.pubkey}, skipping.`, error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGetStakeAccounts({ address }: { address: Address }) {
  const { chain, client } = useMobileWallet()

  return useQuery({
    queryKey: ['get-stake-accounts', chain, address] as const,
    // Strict enabling: never fire an unfiltered query when address is falsy.
    // Without this, the hook downloads the entire network's stake registry on
    // mount, causing an OOM crash on mobile.
    enabled: !!address,
    queryFn: async () => {
      try {
        const [rawAccounts, epochInfo] = await Promise.all([
          client.rpc
            .getProgramAccounts(STAKE_PROGRAM_ADDRESS as Address, {
              encoding: 'base64',
              // memcmp filter on authorized.withdrawer at byte offset 44.
              // This restricts the RPC response to only the connected wallet's
              // stake accounts instead of fetching the entire network registry.
              filters: [
                {
                  memcmp: {
                    offset: 44,
                    bytes: address as string,
                  },
                },
              ],
            } as any)
            .send() as unknown as Array<{ pubkey: string; account: { lamports: number; data: [string, string]; owner: string; executable: boolean; rentEpoch: number; space: number } }>,
          client.rpc.getEpochInfo().send() as unknown as { epoch: bigint },
        ])

        const currentEpoch = epochInfo.epoch

        return rawAccounts.flatMap((raw) => {
          const result = parseStakeAccount(raw, currentEpoch)
          return result ? [result] : []
        })
      } catch (error) {
        console.error("🔴 [LIVE STAKE FETCH CRASH]:", error);
        throw error
      }
    },
  })
}