# solana-mobile-staker

An Android-targeted Solana mobile wallet dApp built with Expo, React Native, `@solana/kit` v2, and `@wallet-ui/react-native-kit`.

## Features

- ✅ Connect/disconnect mobile wallet (Mobile Wallet Adapter) — native connection pipeline with 30-second background timeout mitigation
- ✅ View SOL balance and SPL token accounts (Token + Token-2022)
- ✅ Switch between Solana clusters (Devnet, Testnet)
- ✅ Sign arbitrary messages (Demo tab)
- ✅ Light/dark theme toggle
- ✅ Staking with interactive ValidatorCard UI → tap to navigate to per-validator stake screen (dynamic route with SOL amount input + Stake button)
- ✅ Staking list: filtered (commission < 100%) & sorted (fee ascending + stake descending)
- ✅ Stake SOL via Mobile Wallet Adapter (create stake account → initialize → delegate, 3-instruction transaction)
- ✅ Portfolio Dashboard: `useGetStakeAccounts` hook fetches + decodes user stake accounts with `memcmp` authority filter and `enabled: !!address` guard — prevents OOM from scanning the entire network stake registry
- ✅ Deactivation Transaction: `createHandleDeactivate` pure factory builds + sends deactivate via MWA
- ✅ StakeManagerModal: tap-to-open from portfolio → view stake details + Deactivate Stake button (active/activating only)
- ✅ Portfolio Dashboard wired into Account tab (displayed alongside balance + staking + tokens)
- ✅ Real pull-to-refresh (invalidates react-query cache for balance + tokens)
- ⬜ Request devnet/testnet airdrops (hook ready, screen pending)
- ⬜ Send SOL (hook ready, screen pending)
- ⬜ Receive SOL (QR code + address)

## Tech Stack

- Expo SDK 55 + React Native 0.83+
- expo-router (file-based routing)
- `@wallet-ui/react-native-kit` for `@solana/kit` v2 wallet/Solana interactions
- `@tanstack/react-query` for data fetching and mutations
- `@react-navigation/native` ThemeProvider for theming
- Jest 29 + React Native Testing Library (TDD enforced)

## Hermes & Mobile Wallet Adapter Runtime Notes

### Crypto Polyfills (Required for Hermes)
React Native's Hermes engine does not provide Web Crypto or `Buffer` globals that `@solana/kit` and `@noble/*` depend on. The app loads these polyfills in `polyfill.js` **before** any application code (`index.js`). Order matters:
1. `buffer` — global `Buffer` polyfill
2. `react-native-url-polyfill` — WHATWG URL API
3. `react-native-get-random-values` — `crypto.getRandomValues()`

### Branded `Address` Type Coercion
The `Address` type from `@solana/kit` is a branded nominal type (`NominalType<"brand", "Address">`). Hermes throws `TypeError: Cannot convert Symbol to string` when branded `Address` values are interpolated into template literals or passed to string methods like `.length`. Always wrap `Address` values with `String()` before string operations, template literal interpolation, or `.substring()` / `.length` calls.

### Phantom / MWA Connection
The app uses `@wallet-ui/react-native-kit` which wraps `@solana/kit` v2 and implements the Mobile Wallet Adapter protocol. Connection flow: `NetworkProvider` → `MobileWalletProvider` (reads `selectedNetwork`) → children. Wallet state is accessed via `useMobileWallet()` hook exposing `account`, `connect`, `disconnect`, `signMessages`, `chain`, and `client`.

## Test Status

| Suite | Tests | Status |
|-------|-------|--------|
| `ellipsify()` utility | 7 | ✅ PASS |
| `lamportsToSol()` utility | 5 | ✅ PASS |
| `normalizeColorScheme` hook | 5 | ✅ PASS |
| `useThemeColor` hook | 4 | ✅ PASS |
| `AppTheme` provider | 1 | ✅ PASS |
| `AppText` component | 3 | ✅ PASS |
| `WalletUiButtonConnect` | 2 | ✅ PASS |
| `useGetValidators` hook | 4 | ✅ PASS |
| `ValidatorCard` component | 6 | ✅ PASS |
| `StakingFeature` (filter, sort, navigation, loading, error) | 7 | ✅ PASS |
| `Staking [votePubkey] screen` | 10 | ✅ PASS |
| `RootLayout` auth guard routing | 5 | ✅ PASS |
| `Tab layout` | 1 | ✅ PASS |
| `Staking page` | 1 | ✅ PASS |
| `useGetStakeAccounts` hook | 7 | ✅ PASS |
| `PortfolioDashboard` component | 14 | ✅ PASS |
| `createHandleDeactivate` factory | 9 | ✅ PASS |
| `showDeactivateButton` pure helper | 4 | ✅ PASS |
| `StakeManagerModal` component | 12 | ✅ PASS |
| `createHandleSelectStakeAccount` factory | 2 | ✅ PASS |
| `AccountFeature` component | 11 | ✅ PASS |
| **Total** | **119** | **✅ ALL PASSING** |

## Setup

```bash
npm install
npm test
```

## Running the App

### 1. Install the Development Build

Download the latest development APK from:

- **EAS Build dashboard:** [solana-staker-mobile builds](https://expo.dev/accounts/michelesantagiuliana/projects/solana-staker-mobile/builds) (requires Expo account)
- **GitHub Releases (auto-build):** Push a `v*` tag → GitHub Actions builds via EAS and attaches the APK to a release at `https://github.com/msantagiulianab/solana-staker-mobile/releases`

Alternatively, build locally: `npm run android` (requires Android Studio + SDK).

### 2. Start the Dev Server

Once the development build is installed on your Android device:

```bash
npm run dev:tunnel
```

Scan the QR code from the installed development build app. The deep-link scheme (`solanastakermobile`) is configured in `app.json`.

### USB Debugging

For wired development with a USB-connected device:

```bash
npm run dev
```

## Project Structure

```
.
├── app/                          # expo-router file-based routes
│   ├── _layout.tsx               # Root layout with providers + auth guard
│   ├── sign-in.tsx               # Sign-in screen (connect button)
│   ├── +not-found.tsx            # 404 screen
│   └── (tabs)/
│       ├── _layout.tsx            # Tab navigator (Account/Settings/Demo)
│       ├── account/index.tsx      # AccountScreen → AccountFeature
│       ├── settings/index.tsx     # SettingsScreen (cluster, app config)
│       └── demo/index.tsx         # DemoFeature (sign message)
├── components/
│   ├── account/                  # Account feature + hooks
│   │   ├── account-feature.tsx   # Main account screen (balance, tokens, staking, portfolio)
│   │   ├── account-ui-balance.tsx # SOL balance display
│   │   ├── use-get-balance.ts    # react-query SOL balance hook
│   │   ├── use-get-token-accounts.ts # Token + Token-2022 account hook
│   │   └── __tests__/
│   ├── ui/                       # Generic UI primitives
│   │   ├── app-view.tsx          # Theme-aware View wrapper
│   │   ├── app-text.tsx          # Text with type variants (title, subtitle, etc.)
│   │   ├── app-page.tsx          # SafeAreaView + AppView wrapper
│   │   ├── ui-icon-symbol.tsx    # Icon component (Material Icons fallback)
│   │   └── __tests__/
│   ├── solana/                   # Solana-specific UI
│   │   ├── base-button.tsx       # Themed button with wallet icon
│   │   ├── wallet-ui-button-connect.tsx
│   │   ├── use-wallet-ui-theme.ts # Theme colors for wallet components
│   │   └── __tests__/
│   ├── staking/                  # Staking feature with validator FlatList + on-chain delegation
│   │   ├── staking-feature.tsx
│   │   ├── validator-card.tsx
│   │   └── __tests__/
│   ├── account/                  # Account management
│   │   ├── account-feature.tsx   # Main account screen (balance, tokens, portfolio)
│   │   ├── account-ui-balance.tsx # SOL balance display
│   │   ├── StakeManagerModal.tsx  # Modal for individual stake account management
│   │   ├── use-get-balance.ts    # react-query SOL balance hook
│   │   ├── use-get-token-accounts.ts # Token + Token-2022 account hook
│   │   └── __tests__/
├── features/                     # Data-access hooks + feature screens
│   ├── staking/
│   │   ├── use-get-validators.ts        # react-query hook: getVoteAccounts → current[]
│   │   ├── use-get-stake-accounts.ts    # react-query hook: getProgramAccounts + stake state derivation
│   │   ├── PortfolioDashboard.tsx       # UI component: FlatList of stake cards with state badges
│   │   ├── staking-types.ts             # Shared types/labels/colors (breaks circular dependency)
│   │   ├── deactivate-stake.ts          # Pure factory: createHandleDeactivate
│   │   └── __tests__/
│   ├── network/                  # Network provider + hooks
│   │   ├── network-provider.tsx  # ClusterProvider (React Context)
│   │   ├── network-ui-select.tsx # Cluster dropdown selector
│   │   ├── use-network.tsx       # useNetwork() hook
│   │   └── ...
│   └── account/                  # Account feature screens (sign, disconnect, etc.)
│   ├── app-providers.tsx         # QueryClientProvider + NetworkProvider + WalletProvider
│   └── ...
├── constants/
│   ├── app-config.ts             # App identity + Solana cluster definitions
│   ├── app-styles.ts             # Shared styles
│   └── colors.ts                 # Light/dark color palette
├── hooks/
│   ├── use-color-scheme.ts       # Normalizes light/dark/unspecified
│   └── use-theme-color.ts        # Resolves theme-aware colors with overrides
├── providers/
│   └── app-theme.tsx             # ThemeProvider wrapper
├── utils/
│   ├── ellipsify.ts              # String truncation utility
│   └── lamports-to-sol.ts        # Lamports → SOL conversion
├── jest/
│   └── __mocks__/@expo/          # Jest mocks for native modules
├── test-renderer-shim.js         # createRoot() shim for react-test-renderer@19
├── jest.config.js
└── jest.setup.js