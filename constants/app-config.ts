import { AppIdentity, createSolanaDevnet, createSolanaTestnet, SolanaCluster } from '@wallet-ui/react-native-kit'

export class AppConfig {
  static identity: AppIdentity = {
    name: 'solana-staker-mobile',
    uri: 'https://github.com/msantagiulianab/solana-staker-mobile',
  }
  static networks: SolanaCluster[] = [
    createSolanaDevnet({ url: 'https://api.devnet.solana.com' }),
    createSolanaTestnet({ url: 'https://api.testnet.solana.com' }),
  ]
}