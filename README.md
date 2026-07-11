# solana-mobile-staker

An Android-targeted Solana mobile wallet dApp built with Expo, React Native, and `@solana/kit` v2 via `@wallet-ui/react-native-kit`.

## Features

- Connect/disconnect mobile wallet (Mobile Wallet Adapter)
- View SOL balance and SPL token accounts
- Request devnet/testnet airdrops
- Send SOL to another address
- Receive SOL (display QR code and address)
- Sign arbitrary messages
- Switch between Solana clusters (Devnet, Testnet)
- Light/dark theme toggle
- Staking (coming soon)

## Tech Stack

- Expo SDK 55 + React Native 0.83+
- expo-router (file-based routing)
- @tanstack/react-query for data fetching
- @wallet-ui/react-native-kit for wallet/Solana interactions
- Jest 29 + React Native Testing Library (TDD enforced)

## Test Status

| Target | Status |
|--------|--------|
| `ellipsify()` utility (7 cases) | ✅ PASS |
| `lamportsToSol()` utility (5 cases) | ✅ PASS |
| `AccountFeature` | ⬜ TODO |
| `StakingFeature` placeholder | ⬜ TODO |
| `AccountUiBalance` | ⬜ TODO |
| `WalletUiDropdown` | ⬜ TODO |
| `ClusterProvider` | ⬜ TODO |
| `AuthProvider` | ⬜ TODO |

## Setup

```bash
npm install
npm test
npm run android
```

## Project Structure

```
src/
├── app/                  # expo-router file-based routes
│   ├── _layout.tsx       # Root layout with providers
│   ├── sign-in.tsx       # Sign-in screen
│   └── (tabs)/           # Tab navigator
│       ├── account/      # Account screens
│       ├── settings/     # Settings screens
│       └── demo/         # Demo screens
├── components/           # Shared UI & feature components
├── constants/            # Colors, AppConfig
├── hooks/                # Custom hooks
├── providers/            # Context providers
└── utils/                # Utility functions