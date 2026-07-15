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

---

## 2026-07-15 — Core Staking: Validator Data Fetching via getVoteAccounts

### Architectural Decisions
- **Hook location:** Created `features/staking/use-get-validators.ts` following the same pattern as `features/network/use-network-get-genesis-hash.tsx` and `features/account/use-account-get-balance.tsx` — data-access hooks live in `features/<domain>/` as a flat file, not nested in `components/`.
- **RPC method:** Used `client.rpc.getVoteAccounts().send()` from `@solana/kit` v2. This returns `{ current: VoteAccount[], delinquent: VoteAccount[] }`. We extract only the `current` array (active, healthy validators).
- **Query key:** `['getVoteAccounts', chain]` — consistent with existing pattern of `[operationName, chain]`.
- **UI component update:** `StakingFeature` (in `components/staking/`) now imports `useGetValidators`, handles loading/error/data states, and renders a `FlatList` with `votePubkey` and `commission` for each validator. The commission is rendered as a raw percentage (as returned by the RPC, e.g., `50` = 50%).

### What Was Tested (7 new tests, 2 new suites, all passing)
| Suite | Tests | Status |
|-------|-------|--------|
| `useGetValidators` hook | 4 | ✅ |
| `StakingFeature` (validators FlatList) | 3 | ✅ |

### MWA/Solana Complexities Handled
- **`getVoteAccounts` RPC mock:** The `@wallet-ui/react-native-kit` `client` is deeply nested (`client.rpc.getVoteAccounts.mockReturnValue({ send: fn })`), requiring a double-level mock: `getVoteAccounts` returns `{ send: jest.fn() }` and `send` returns the actual data.
- **Async `render` and `renderHook`:** Both return Promises in `@testing-library/react-native` v14, requiring `await` destructuring. Tests use `await renderHook(...)` and `await render(...)`.
- **No type imports needed:** The hook returns the raw RPC response data as-is. We don't type the validator shape yet since we're just passing through `response.current`.

### Test Baseline (36 tests, 10 suites)
Post-implementation: 36 tests, 10 suites, all GREEN.

---

## 2026-07-15 — Route Auth Guard & Staking Coverage Regression Tests

### Context
Performed a comprehensive repository health check to ensure Staking tab and routing changes are fully tested and securely versioned.

### Coverage Audit Findings
- **`app/_layout.tsx` (auth guard):** 0% tested. The `useEffect` that redirects unauthenticated users to `/sign-in` and authenticated users to `/staking` was untested.
- **`app/(tabs)/_layout.tsx` (tab layout):** 0% tested. No smoke test for the 4-tab `Tabs` navigator.
- **`app/(tabs)/staking/index.tsx` (staking page):** 0% tested. No smoke test.
- **`StakingFeature` loading/error states:** Only happy path was tested; loading and error branches were untested.

### Tests Added (7 new tests, 3 new suites)

| Suite | Tests | Status |
|-------|-------|--------|
| `RootLayout auth guard routing` | 5 | ✅ |
| `Tab layout` | 1 | ✅ |
| `Staking page` | 1 | ✅ |

### StakingFeature Expanded

| Branch | Tests | Status |
|--------|-------|--------|
| Loading state | 1 | ✅ |
| Error state | 1 | ✅ |

### jest.mock Complexity Handled
- **`expo-router` Stack/Tabs.Screen static properties:** The `jest.mock` factory function must create mock components inside the factory closure because `jest.mock` factories are hoisted above `const` declarations (Temporal Dead Zone). `Stack.Screen`, `Stack.Group`, and `Tabs.Screen` must be attached as static properties on the mock component function.
- **ESM module mock:** `@wallet-ui/react-native-kit` is an ESM module (`*.mjs`) that cannot be parsed by Jest. All tests that transitively import it must use a factory-function mock with `jest.mock('@wallet-ui/react-native-kit', () => ({...}))`.
- **Factory mock vs auto-mock:** `jest.mock('@/features/staking/use-get-validators')` without a factory creates an auto-mock that still tries to parse the real module (which imports `@wallet-ui/react-native-kit`). Must always use a factory function `() => ({ useGetValidators: () => mockFn() })`.

### Test Baseline (43 tests, 12 suites)
Post-audit: 43 tests, 12 suites, all GREEN.