import { useQuery } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import type { Address } from '@solana/kit'

export function useGetTokenAccounts({ address }: { address: Address }) {
  const { chain, client } = useMobileWallet()
  return useQuery({
    queryKey: ['get-token-accounts', chain, address],
    queryFn: async () => {
      // Note: use getTokenAccountsByOwner with jsonParsed encoding for parsed data
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        client.rpc
          .getTokenAccountsByOwner(
            address,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address },
            { commitment: 'confirmed', encoding: 'jsonParsed' },
          )
          .send(),
        client.rpc
          .getTokenAccountsByOwner(
            address,
            { programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address },
            { commitment: 'confirmed', encoding: 'jsonParsed' },
          )
          .send(),
      ])
      return [...(tokenAccounts.value ?? []), ...(token2022Accounts.value ?? [])]
    },
  })
}