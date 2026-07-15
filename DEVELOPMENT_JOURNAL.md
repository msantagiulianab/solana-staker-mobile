# Development Journal

## 2026-07-11 — Full Feature Implementation

### Architectural Decisions
- **Test Renderer Shim:** React 19 removed `createRoot()` from `react-test-renderer`. Created a comprehensive shim (`test-renderer-shim.js`) that bridges `create()` to `createRoot()` API for `@testing-library/react-native` v14 compatibility.
- **@expo/vector-icons Mock:** Created a Jest mock (`jest/__mocks__/@expo/vector-icons.jsx`) to avoid native module loading (`__fbBatchedBridgeConfig`) during testing.
- **Project uses `@wallet-ui/react-native-kit`** wrapping `@solana/kit` v2 — no legacy `@solana/web3.js` v1 or `@wallet-ui/react-native-web3js` contamination.
- **Jest 29.7.0** installed for jest-expo 57 compatibility (v30 had API conflicts).
- **Theme system** uses `@react-navigation/native` `ThemeProvider` with custom `Colors` constants and `useColorScheme` hook that normalizes `'unspecified'` to `'light'`.

### What Was Tested (29 tests, 8 suites, all passing)
| Suite | Tests | Status |
|-------|-------|--------|
| `ellipsify` utility | 7 | ✅ |
| `lamportsToSol` utility | 5 | ✅ |
| `normalizeColorScheme` hook | 5 | ✅ |
| `useThemeColor` hook | 4 | ✅ |
| `AppTheme` provider | 1 | ✅ |
| `AppText` component | 3 | ✅ |
| `StakingFeature` placeholder | 2 | ✅ |
| `WalletUiButtonConnect` | 2 | ✅ |

### Solana/Wallet Complexities
- **Token account fetching** adapted from `getParsedTokenAccountsByOwner` to `getTokenAccountsByOwner` with `encoding: 'jsonParsed'` for @solana/kit v2 compatibility.
- **Account RPC response** returns `{ context, value }` wrapper instead of raw lamports — balance hook extracts `.value` at the query layer.
- **MobileWalletProvider** from `@wallet-ui/react-native-kit` provides `useMobileWallet()` with `account`, `connect`, `disconnect`, `signMessages`, `chain`, `client`.
- Provider tree: `NetworkProvider` → `MobileWalletProvider` (reads selectedNetwork) → children. All wrapped in `QueryClientProvider`.
- Network context exposes `chain`, `endpoint`, `getExplorerUrl`, `networks`, `selectedNetwork`, `setSelectedNetwork` via `useNetwork()`.

## 2026-07-11 — Symbol-to-String Crash Fix (post-auth)

### Root Cause
The `Address` type from `@solana/kit` is a branded type (`NominalType<"brand", "Address">`). When Hermes (React Native's JS engine) encountered branded `Address` values interpolated in template literals (e.g., `` `msg ${address}` ``) or passed to string methods like `.length` / `.substring()`, it threw `TypeError: Cannot convert Symbol to string`.

### Fixes Applied
- **`utils/ellipsify.ts`:** Changed parameter to `unknown`, coerces input via `String(str ?? '')` before calling `.length`/`.substring()`. This protects all `ellipsify()` call sites from branded types.
- **`features/account/account-feature-sign-message.tsx`:** Wrapped `address` with `String(address)` in template literal.
- **`features/account/account-feature-sign-transaction.tsx`:** Wrapped `address` with `String(address)` in memo template literal.
- **`features/account/account-feature-index.tsx`:** Wrapped `account.label` with `String(account.label ?? '')` in JSX text interpolation.

### Verification
All 29 tests pass post-fix.

---

### Implemented Features
- ✅ Connect/disconnect mobile wallet
- ✅ SOL balance display (`AccountUiBalance`)
- ✅ Token accounts listing (Token + Token-2022 merged)
- ✅ Staking placeholder ("coming soon")
- ✅ Tab navigation (Account, Settings, Demo)
- ✅ Settings screen (cluster selector, app config)
- ✅ Demo screen (sign message)
- ✅ Sign-in screen with conditional routing
- ✅ Not-found screen
- ✅ Light/dark theme support via `AppTheme`
- ✅ `AppView`, `AppText` (with type variants), `AppPage` base components
- ✅ `UiIconSymbol` with Material Icons fallback
- ✅ `BaseButton`, `WalletUiButtonConnect` Solana UI components

## 2026-07-15 — Root Layout TypeScript Fix (Stack.Group → Fragment Removal)

### Root Cause
The file `app/_layout.tsx` used `<>...</>` (React Fragment) to wrap conditional `Stack.Screen` children. When the copilot suggested replacing the fragment with `Stack.Group`, it triggered a TypeScript error because `Stack` from `expo-router` (native stack navigator) does **not** expose a `Group` component — only `@react-navigation/native`'s `Navigator`/`Group` supports grouping, and even then the fragment pattern is unnecessary here.

### Fix Applied
- Removed the fragment `<>...</>` wrapper entirely.
- Moved the `+not-found` screen **outside** the conditional so it's always registered (regardless of auth state).
- Conditionally renders `(tabs)` when authenticated or `sign-in` when not.
- `tsc --noEmit` passes cleanly on `app/_layout.tsx` (zero errors).

### Architectural Decision
Always registering the `+not-found` screen outside conditional blocks prevents cryptic "route not found" edge cases when users land on unknown paths regardless of auth state.

## 2026-07-15 — README Updated with Hermes/MWA Runtime Documentation

### Added Sections
- **Crypto Polyfills (Required for Hermes):** Documented the 3-polyfill chain (`buffer` → `url-polyfill` → `get-random-values`) loaded in `polyfill.js` before `index.js`, needed by `@solana/kit` / `@noble/*`.
- **Branded Address Type Coercion:** Documented the `Address` nominal type from `@solana/kit` and the `TypeError: Cannot convert Symbol to string` Hermes crash, with the `String()` wrapping fix.
- **Phantom / MWA Connection:** Documented the provider tree (`NetworkProvider` → `MobileWalletProvider` → children) and `useMobileWallet()` API surface.

### Squash Plan
All 3 unpushed commits (polyfills, Symbol-to-string fix, layout fix) will be squashed into a single commit covering the stable MWA connection loop milestone.
