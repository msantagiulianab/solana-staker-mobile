import { useQuery } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import type { Address } from '@solana/kit'

export function useGetBalance({ address }: { address: Address }) {
  const { chain, client } = useMobileWallet()
  return useQuery({
    queryKey: ['get-balance', chain, address],
    queryFn: async () => {
      const response = await client.rpc.getBalance(address).send()
      // @solana/kit v2's getBalance returns SolanaRpcResponse<bigint>
      // which is { context: { slot: bigint }, value: bigint }.
      // Extract .value to get the raw lamports bigint.
      return (response as unknown as { value: bigint }).value
    },
  })
}

export function useGetBalanceInvalidate({ address }: { address: Address }) {
  const { chain } = useMobileWallet()
  // Returns nothing — invalidation is done by the invalidation function
  // Use queryClient.invalidateQueries({ queryKey: ['get-balance', chain, address] })
  return { queryKey: ['get-balance', chain, address] as const }
}