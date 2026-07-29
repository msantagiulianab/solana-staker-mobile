import { AppIdentity, createSolanaDevnet, createSolanaTestnet, SolanaCluster } from '@wallet-ui/react-native-kit'

export class AppConfig {
  static identity: AppIdentity = {
    name: 'solana-staker-mobile',
    uri: 'https://example.com',
  }
  static networks: SolanaCluster[] = [
    createSolanaDevnet({ url: 'https://devnet.helius-rpc.com/?api-key=6bb482a3-38f9-4ea7-ac96-42ce915807e8' }),
    createSolanaTestnet({ url: 'https://api.testnet.solana.com' }),
  ]
}