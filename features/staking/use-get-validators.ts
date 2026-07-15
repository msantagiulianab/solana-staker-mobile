import { useQuery } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'

export function useGetValidators() {
  const { chain, client } = useMobileWallet()
  return useQuery({
    queryKey: ['getVoteAccounts', chain],
    queryFn: async () => {
      const response = await client.rpc.getVoteAccounts().send()
      return response.current
    },
  })
}