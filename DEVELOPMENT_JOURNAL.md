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

---

## 2026-07-16 — Validator Filtering & Sorting via useMemo (Logic Route)

### Architectural Decisions
- **Filter logic:** Validators with `commission === 100` are excluded. Commission of 100% means the validator takes all rewards and gives nothing to delegators — these are not viable staking options.
- **Sort logic:** Remaining validators sorted by `commission` ascending (lowest fees first). On tie, secondary sort by `activatedStake` descending (highest trusted stake first), aligning with Solana's best-practice validator selection.
- **Memoization:** Used `useMemo` with `[validators]` dependency to avoid re-filtering/re-sorting on every render. The memo returns `[]` when `validators` is falsy (loading/error guard).
- **testID on FlatList:** Added `testID="validator-list"` to the FlatList for clean test access without `UNSAFE_*` APIs. Tests inspect the `data` prop directly to verify sort order.

### What Was Tested (2 new tests, 2 updated tests)
| Test | Status |
|------|--------|
| `filters out validators with 100% commission` | ✅ |
| `sorts validators by commission ascending (0% before 5% before 50%)` | ✅ |
| `renders validator votePubkeys ... (excluding 100% filtered)` | ✅ (updated) |
| `renders validator commissions (excluding filtered 100%)` | ✅ (updated) |

### Test Strategy for Sort Verification
Rather than using `getAllByText` regex matching on rendered text (which breaks due to React children interpolation arrays), the test uses `getByTestId('validator-list')` to access the FlatList instance and asserts on `flatList.props.data` directly — verifying both the commission values and the exact `votePubkey` order.

### Test Baseline (45 tests, 12 suites)
Post-implementation: 45 tests, 12 suites, all GREEN.

---

## 2026-07-16 — ValidatorCard Component: UI/UX Card Layout

### Architectural Decisions
- **New component `ValidatorCard`** in `components/staking/validator-card.tsx` following the project's pattern of domain-specific UI components (parallel to `account-ui-balance.tsx`, `wallet-ui-button-connect.tsx`).
- **Props:** `votePubkey: string` and `commission: number` — minimal, single-responsibility interface.
- **Ellipsification:** Uses the existing `ellipsify()` utility with default parameters (4 chars prefix, 4 chars suffix, `..` delimiter) to truncate long public keys for clean mobile display.
- **Card styling:** Rounded corners (`borderRadius: 12`), subtle border (`#e0e0e0`), shadow + elevation for depth, `flexDirection: 'row'` with `justifyContent: 'space-between'` for the commission row — aligns label left and value right.
- **StakingFeature updated:** `renderItem` now returns `<ValidatorCard>` instead of raw `<AppView>` + `<AppText>`. The `validatorItem` styles were removed from `StakingFeature`'s `StyleSheet` since they're now internal to `ValidatorCard`.

### What Was Tested (5 new tests, 1 new suite)
| Suite | Tests | Status |
|-------|-------|--------|
| `ValidatorCard` | 5 | ✅ |

| Test | Verification |
|------|-------------|
| `renders the ellipsified votePubkey` | Long key "VeryLongValidatorPubKey123456789" → "Very..6789" |
| `renders the commission percentage` | `10` → renders "10%" |
| `renders the "Commission:" label` | Label text present |
| `does not truncate a short votePubkey` | Short key "abc" unchanged |
| `renders 0% commission correctly` | Zero edge case verified |

### Existing StakingFeature Tests Updated
All text assertions updated to match ValidatorCard's output format:
- `Vote Key: abc123` → `abc123` (pubkey now rendered directly via `ellipsify`)
- `Commission: 50%` → `50%` + `Commission:` label (split into separate elements)

### Test Baseline (50 tests, 13 suites)
Post-implementation: 50 tests, 13 suites, all GREEN.

---

## 2026-07-16 — Phase 3: Staking Flow — Interactive Cards + Dynamic Route

### Architectural Decisions
- **Interactive ValidatorCard:** Wrapped card content in `TouchableOpacity` with `activeOpacity={0.7}` for press feedback. Added optional `onPress` prop and `accessibilityRole="button"` for proper screen reader support.
- **Expo Router dynamic routing:** Used `useRouter().push(`/staking/${String(votePubkey)}`)` in `StakingFeature` to navigate to a per-validator staking screen. The `String()` coercion is required because `votePubkey` is a branded `Address` type from `@solana/kit` (same issue as the 2026-07-11 Symbol-to-String fix).
- **Dynamic route screen** `app/(tabs)/staking/[votePubkey].tsx`: Uses `useLocalSearchParams` to extract `votePubkey`. Displays full pubkey (selectable), numeric `TextInput` for SOL amount, and a styled "Stake SOL" button. No transaction logic yet — pure UI placeholder.
- **Test approach for onPress:** Due to `react-test-renderer` shim incompatibility with `TouchableOpacity` press simulation, the `onPress` test verifies the `testID` is rendered on the touchable element. This matches existing project patterns (e.g., `WalletUiButtonConnect` does not simulate clicks either).

### What Was Tested (6 new tests, 1 new suite, 1 updated suite)
| Suite | Tests | Status |
|-------|-------|--------|
| `ValidatorCard` (onPress card) | 6 (+1) | ✅ |
| `Staking [votePubkey] screen` | 4 | ✅ |
| `StakingFeature` (expo-router mock) | 7 (updated) | ✅ |

| Test | Verification |
|------|-------------|
| `renders as a touchable card with an onPress handler` | testID "validator-card" present in DOM |
| `renders the votePubkey header` | "Stake with Validator" title |
| `displays the full votePubkey from params` | "abc123" from mock params |
| `renders the SOL amount TextInput` | placeholder "0.0" present |
| `renders the Stake SOL button` | "Stake SOL" text rendered |

### Test Baseline (55 tests, 14 suites)
Post-implementation: 55 tests, 14 suites, all GREEN.

---

## 2026-07-16 — Phase 4: On-Chain Staking Transaction (Stake SOL Button)

### Architectural Decisions
- **Pure logic extraction:** The staking handler logic lives in `createHandleStake(account, amount, votePubkey, sendTransactions)`, an exported pure factory function. Tests import it directly and invoke the returned async function — no DOM event simulation needed. This sidesteps RNTL's inability to trigger `Pressable.onPress` or `TouchableOpacity.onPress` via `fireEvent.press` (React Native's native gesture responder system intercepts before RNTL's JS-level events reach the handler).
- **Dependency injection:** `sendTransactions` (from `useMobileWallet()`) is passed as a parameter to `createHandleStake`, enabling tests to supply a `jest.fn()` mock without mocking the entire `@wallet-ui/react-native-kit` module. The component wires it via `useCallback(createHandleStake(account, amount, votePubkey, sendTransactions), [...])`.
- **Component uses `Pressable`** with `testID="stake-button"` and `onPress={handleStake}`, replacing the static `AppView` placeholder from Phase 3.
- **Stake program clients:** Installed `@solana-program/stake@0.7.2` (peer: `@solana/kit@^6.4.0`) and `@solana-program/system@0.12.2` (peer: `@solana/kit@^6.4.0`) for typed instruction builders: `getCreateAccountInstruction`, `getInitializeCheckedInstruction`, `getDelegateStakeInstruction`. Both use `--legacy-peer-deps` due to Expo 55 / React Native 0.83 peer conflicts.
- **Validation order:** 1) Account check (must be connected), 2) Amount check (`!amount || isNaN(Number(amount)) || Number(amount) <= 0`), 3) Vote pubkey check. All validation happens before any `solToLamports` or `generateKeyPairSigner` calls — no silent crashes.

### Transaction Building Flow
1. `generateKeyPairSigner()` creates a new stake account keypair.
2. `getCreateAccountInstruction` transfers SOL (amount + rent-exempt minimum of 2,282,880 lamports) from user to new stake account, allocating 200 bytes owned by the Stake program.
3. `getInitializeCheckedInstruction` initializes the stake account state with user as both stake and withdraw authority.
4. `getDelegateStakeInstruction` delegates the initialized stake to the validator's vote pubkey.
5. `sendTransactions(instructions)` signs and sends via Mobile Wallet Adapter bridge.

### What Was Tested (10 tests, 1 suite, all passing)
| Suite | Tests | Status |
|-------|-------|--------|
| `Staking [votePubkey] screen` | 10 | ✅ |

| Test | Status |
|------|--------|
| renders the votePubkey header | ✅ |
| displays the full votePubkey from params | ✅ |
| renders the SOL amount TextInput | ✅ |
| renders the Stake SOL button | ✅ |
| shows error alert when user is not connected | ✅ |
| shows error alert when amount is zero or invalid | ✅ |
| shows error alert when votePubkey is missing | ✅ |
| builds and sends the correct staking transaction | ✅ |
| shows success alert with transaction signature | ✅ |
| shows error alert on transaction failure | ✅ |

### MWA/Solana Complexities Handled
- **Jest mock hoisting:** `jest.mock()` factories execute before variable declarations. Mock functions must be defined inline inside factory functions — external `const` references are `undefined` at hoist time.
- **`jest.clearAllMocks()` destroys mock implementations:** This resets `jest.fn(() => ({ account, sendTransactions }))` to `jest.fn()` (returning `undefined`), causing silent component crash on destructure. Replaced with targeted `jest.mocked().mockClear()` on each individual mock.
- **RNTL cannot trigger `Pressable.onPress` or `TouchableOpacity.onPress`:** Both components use React Native's native gesture responder system internally, which RNTL's JS-level `fireEvent.press`/`pressIn`/`pressOut`/`touchStart`/`touchEnd`/`responderRelease` events cannot reach. The pure function extraction pattern eliminates this limitation entirely.
- **`@solana/kit` v2 branded types:** `address()`, `sol()` functions produce branded nominal types. Instruction builders require these typed values; tests mock `address` and `sol` as identity functions to bypass runtime validation.
- **Rent-exempt math:** `2_282_880n` lamports for a 200-byte stake account. Total = stake amount + rent, verified in test assertion (`1_502_282_880n = 1_500_000_000 + 2_282_880`).
- **`sendTransactions` signature:** Returns `Promise<string>` (the transaction signature). Component's `useMobileWallet().sendTransactions` is passed as 4th argument to pure factory.

### Test Baseline (65 tests, 14 suites)
Post-implementation: 65 tests, 14 suites, all GREEN.

---

## 2026-07-16 — Phase 5: Portfolio Dashboard — useGetStakeAccounts Hook

### Architectural Decisions
- **Hook location:** `features/staking/use-get-stake-accounts.ts` — following the same pattern as `use-get-validators.ts` in the same directory.
- **RPC methods used:**
  - `client.rpc.getProgramAccounts(STAKE_PROGRAM_ADDRESS, { encoding: 'base64' })` to fetch all stake accounts owned by the Stake program.
  - `client.rpc.getEpochInfo()` to get the current epoch for state derivation.
- **Decoding:** Uses `decodeAccount` from `@solana/kit` with `getStakeStateAccountDecoder()` from `@solana-program/stake` to parse the binary `StakeStateV2` data.
- **State derivation:** Pure function `deriveStakeState(stakeStateV2, currentEpoch)` returns `'active' | 'activating' | 'deactivating' | 'inactive'` based on:
  - `deactivationEpoch <= currentEpoch` → `'deactivating'`
  - `activationEpoch > currentEpoch` → `'activating'`
  - `activationEpoch <= currentEpoch && deactivationEpoch === U64_MAX` → `'active'`
  - Any non-Stake variant → `'inactive'`
- **Return type:** `StakeAccountInfo` — `{ pubkey, lamports, state, voterPubkey?, delegatedAmount? }`.
- **Query key:** `['get-stake-accounts', chain, address]` — consistent with existing pattern.

### Jest Mock Strategy
- **`@solana/kit` mocked entirely:** The module's `.mjs` ESM entry-point cannot be parsed by Jest. `decodeAccount` is replaced with a pure function that returns pre-built `StakeStateV2` shapes keyed by pubkey — no real binary decoding needed at test time.
- **`@solana-program/stake` mocked:** `STAKE_PROGRAM_ADDRESS` exported as string literal; `getStakeStateAccountDecoder` returns a dummy decoder (never actually used since `decodeAccount` is mocked above).
- **All mock data generation inline:** Factory functions for state maps, account info objects, and `makeMeta`/`makeStakeFields` helpers are all defined INSIDE the `jest.mock()` factory callbacks to avoid out-of-scope variable references (Jest hoisting constraint).
- **`jest.config.js` updated:** Added `@solana-program/.*` to `transformIgnorePatterns` (in addition to existing `@solana/.*`) to allow Jest to transform the CJS build of `@solana-program/stake` when the real module is needed.

### What Was Tested (7 tests, 1 new suite)
| Suite | Tests | Status |
|-------|-------|--------|
| `useGetStakeAccounts` hook | 7 | ✅ |

| Test | Status |
|------|--------|
| calls getProgramAccounts with the Stake program address | ✅ |
| fetches the current epoch | ✅ |
| returns parsed stake accounts with pubkey, lamports, and state | ✅ |
| marks deactivating stake when deactivationEpoch < current epoch | ✅ |
| surfaces error when epoch fetch fails | ✅ |
| returns empty array when no accounts are returned | ✅ |
| uses the correct queryKey with chain and address | ✅ |

### MWA/Solana Complexities Handled
- **`@solana/kit` v2 branded types:** `decodeAccount` expects `Lamports`, `Address`, and other branded nominal types. The hook uses `as any` on the encoded object to bypass type-checking at the boundary — at runtime these are plain `bigint`/`string` values.
- **`getProgramAccounts` return shape:** The @solana/kit v2 API returns a branded `SolanaRpcResponse<...>` wrapper with `.context` and `.value` when filters are used, but a plain array when no `withContext` is set. The hook casts through `as unknown` to access the value array directly.
- **`voterPubkey` branded type:** `stake.delegation.voterPubkey` is `Address` (branded). The hook coerces via `as unknown as string` for the public API surface.

### Test Baseline (68 tests, 15 suites)
Post-implementation: 68 tests, 15 suites, all GREEN.

---

## 2026-07-16 — Phase 5: Portfolio Dashboard UI Component

### Architectural Decisions
- **Component location:** `features/staking/PortfolioDashboard.tsx` — UI component separated from data-access hook following the established pattern (`features/` for data + presentation, `components/` for reusable primitives).
- **Props interface:** `{ address: string }` — the component receives the user's wallet address and passes it to `useGetStakeAccounts`. No `useMobileWallet` dependency at this level; the parent component (Account/staking page) wires the wallet address.
- **State branches:** Loading → "Loading stake accounts...", Error → "Failed to load stake accounts.", Empty → "No stake accounts found.", Data → FlatList of stake account cards.
- **Each card displays:**
  - Truncated pubkey (via `ellipsify`, 4+4 chars)
  - State badge with color (`getStakeStateColor`: active=green, activating=orange, deactivating=red, inactive=gray)
  - Delegated amount in SOL (via `lamportsToSol`, formatted to 2 decimal places)
  - Vote key (truncated, optional)
- **Pure helpers exported for direct testing:**
  - `STAKE_STATE_LABELS` — Record mapping state → human-readable label
  - `getStakeStateColor(state)` — Returns hex color string for given state
  - `formatDelegatedAmount(account)` — Returns "N/A" for undefined, otherwise "X.XX SOL"

### What Was Tested (14 tests, 3 describe blocks)
| Suite | Tests | Status |
|-------|-------|--------|
| `getStakeStateColor` (pure) | 4 | ✅ |
| `STAKE_STATE_LABELS` (pure) | 1 | ✅ |
| `PortfolioDashboard` (component) | 9 | ✅ |

| Test | Status |
|------|--------|
| returns green for active | ✅ |
| returns orange for activating | ✅ |
| returns red for deactivating | ✅ |
| returns gray for inactive | ✅ |
| has human-readable labels for all states | ✅ |
| passes the address to useGetStakeAccounts | ✅ |
| renders loading indicator when isLoading is true | ✅ |
| renders error message when isError is true | ✅ |
| renders empty state when data is an empty array | ✅ |
| renders stake account cards with delegated amount in SOL | ✅ |
| renders stake account cards with state badges | ✅ |
| renders truncated pubkeys for each account | ✅ |
| shows "N/A" for delegatedAmount when undefined | ✅ |
| renders title header | ✅ |

### Test Baseline (82 tests, 16 suites)
Post-implementation: 82 tests, 16 suites, all GREEN.

---

## 2026-07-17 — Phase 6: Lifecycle Management — Deactivation Transaction

### Architectural Decisions
- **Pure factory function:** `createHandleDeactivate(stakeAccountPubkey, authorizedPubkey, sendTransaction)` in `features/staking/deactivate-stake.ts`. Same pattern as Phase 4's `createHandleStake` — pure logic extraction with dependency injection for MWA's `sendTransaction`.
- **Single instruction:** Deactivation only requires one instruction (`getDeactivateInstruction` from `@solana-program/stake`), unlike the 3-instruction delegation flow. No keypair generation needed — the existing stake account is modified directly.
- **Input validation order:** 1) `stakeAccountPubkey` must be non-empty, 2) `authorizedPubkey` must be non-empty (wallet connected), 3) `sendTransaction` must be available. All validation runs before any `@solana/kit` or `@solana-program/stake` calls.
- **Instruction builder signature:** `getDeactivateInstruction` expects `{ stake: Address, stakeAuthority: TransactionSigner }`. The factory wraps `authorizedPubkey` in a `{ address }` object to satisfy the `TransactionSigner` interface shape. `clockSysvar` defaults to the sysvar address automatically.

### What Was Tested (9 tests, 1 new suite)
| Suite | Tests | Status |
|-------|-------|--------|
| `createHandleDeactivate` | 9 | ✅ |

| Test | Status |
|------|--------|
| shows error alert when stakeAccountPubkey is undefined | ✅ |
| shows error alert when authorizedPubkey is undefined | ✅ |
| shows error alert when sendTransaction is undefined | ✅ |
| builds deactivate instruction and sends transaction | ✅ |
| shows success alert with transaction signature | ✅ |
| shows error alert on transaction failure | ✅ |
| shows error alert when stakeAccountPubkey is an empty string | ✅ |
| shows error alert when authorizedPubkey is an empty string | ✅ |
| does not call sendTransaction if getDeactivateInstruction throws | ✅ |

### MWA/Solana Complexities Handled
- **`TransactionSigner` shape:** Unlike `generateKeyPairSigner()` which returns `{ address, keyPair }`, the real MWA signer provides an object with `.address`. The factory passes `{ address: authorizedPubkey }` to satisfy the `TransactionSigner` interface in tests.
- **`getDeactivateInstruction` API:** Accepts `stake: Address` and `stakeAuthority: TransactionSigner` with optional `clockSysvar`. The test verifies the instruction is built with `expect.objectContaining({ stake, stakeAuthority: { address } })` pattern.
- **Error isolation:** If `getDeactivateInstruction` throws (invalid stake account), `sendTransaction` must not be called. This is covered by the final edge-case test.

### Test Baseline (91 tests, 17 suites)
Post-implementation: 91 tests, 17 suites, all GREEN.

---

## 2026-07-17 — Phase 6: UI Integration — StakeManagerModal + PortfolioDashboard Tap-to-Open

### Architectural Decisions
- **Component location:** `components/account/StakeManagerModal.tsx` — modal component placed alongside existing `account-feature.tsx` and `account-ui-balance.tsx` since it manages individual stake accounts (a sub-concern of the Account domain).
- **Props interface:** `{ stakeAccount: StakeAccountInfo, visible: boolean, onClose: () => void }` — minimal, single-responsibility. The modal does not own visibility state; the parent (PortfolioDashboard) controls it via `visible`/`onClose`.
- **Pure helper `showDeactivateButton(state)`:** Exported and tested directly without rendering. Returns `true` only for `'active'` and `'activating'` states — deactivating and inactive accounts should not show the deactivate button.
- **Deactivation wiring:** Uses `useMobileWallet()` inside the modal to extract `account?.address` (authorized pubkey) and `sendTransactions`. These are passed to `createHandleDeactivate()` from Phase 5 via `useMemo` dependency on `[stakeAccount.pubkey, account?.address, sendTransactions]`.
- **PortfolioDashboard tap-to-open:** Each stake account `FlatList` row is now wrapped in a `<Pressable>` with an `onPress` handler created by `createHandleSelectStakeAccount(account, setSelectedAccount, setModalVisible)` — a pure factory. When called, it sets the selected account in state and opens the modal. This follows the pure-logic-extraction pattern from `.clinerules`: press handlers are extracted as exported factories, tested directly without rendering, while the component merely wires the factory to `onPress`.
- **Imported UI primitives** from `PortfolioDashboard`: `STAKE_STATE_LABELS` and `getStakeStateColor` — reused in the modal to display consistent state badges and colors, avoiding duplication.
- **Modal UI:** Uses React Native `Modal` with `transparent` + `animationType="slide"`. The overlay has `rgba(0,0,0,0.5)` for a dimming effect. The card displays Address (selectable), Status (colored badge), Delegated amount (SOL, 2 decimals), and Validator vote pubkey (or "N/A"). The "Deactivate Stake" button is styled in red (`#F44336`) and only rendered when `canDeactivate` is true.

### Test Architecture
- **StakeManagerModal tests (16 tests):** Mock `createHandleDeactivate`, `useMobileWallet`, and `PortfolioDashboard` exports to isolate the modal from ESM `@solana/kit`/`@solana-program/stake` chain. The `@solana/kit` ESM entry-point crashes Jest; the `PortfolioDashboard` mock prevents the transitive import of `use-get-stake-accounts` → `@solana-program/stake` → `@solana/kit`.
- **PortfolioDashboard expanded tests (2 new pure factory tests):** `createHandleSelectStakeAccount` tested directly with mock `setSelectedAccount`/`setModalVisible` state setters. The modal itself is mocked (`jest.mock('@/components/account/StakeManagerModal')`) to prevent ESM cascade.

### What Was Tested (18 new tests, 2 new suites)
| Suite | Tests | Status |
|-------|-------|--------|
| `showDeactivateButton` (pure) | 4 | ✅ |
| `StakeManagerModal` (component) | 12 | ✅ |
| `createHandleSelectStakeAccount` (pure factory) | 2 | ✅ |

| Test | Status |
|------|--------|
| returns true for active state | ✅ |
| returns true for activating state | ✅ |
| returns false for deactivating state | ✅ |
| returns false for inactive state | ✅ |
| renders nothing when visible is false | ✅ |
| renders modal content when visible is true | ✅ |
| displays the stake account pubkey | ✅ |
| displays the stake account status with correct label | ✅ |
| displays the delegated amount in SOL | ✅ |
| displays voter pubkey | ✅ |
| shows N/A when voterPubkey is undefined | ✅ |
| shows Deactivate Stake button for active state | ✅ |
| does not show Deactivate Stake button for deactivating state | ✅ |
| does not show Deactivate Stake button for inactive state | ✅ |
| calls createHandleDeactivate with correct args when modal is visible | ✅ |
| shows close button | ✅ |
| sets the selected account and opens modal when called | ✅ |
| works with a deactivating account | ✅ |

### MWA/Solana Complexities Handled
- **ESM import chain avoidance:** `StakeManagerModal` imports `PortfolioDashboard` for `STAKE_STATE_LABELS`/`getStakeStateColor`. PortfolioDashboard imports `useGetStakeAccounts` which imports `@solana-program/stake` → `@solana/kit` (ESM `.mjs`). In tests, we mock `PortfolioDashboard` to inline the same labels/colors, breaking the ESM chain. The real component handles this fine at runtime (Metro bundles ESM).
- **RNTL Pressability constraint (again):** `fireEvent.press()` cannot trigger `Pressable.onPress` in RNTL. The `createHandleSelectStakeAccount` pure factory avoids fighting the framework — tested as a plain function call with mock state setters.

### Test Baseline (109 tests, 19 suites)
Post-implementation: 109 tests, 19 suites, all GREEN.

---

## 2026-07-17 — Phase 6 Completion: StakeManagerModal UI + Ed25519 Environment Polyfill

### Architectural Decisions
- **StakeManagerModal component:** Finalized in `components/account/StakeManagerModal.tsx` using React Native `Modal` with `transparent` background and `animationType="slide"`. The modal provides a detailed view of an individual stake account (Address, Status badge with color, Delegated amount in SOL, Validator vote pubkey) and a conditional "Deactivate Stake" button wired to `createHandleDeactivate()` from Phase 6.
- **Pure helpers exported for direct testing:**
  - `showDeactivateButton(state: StakeState)` — Returns `true` only for `'active'` and `'activating'`; prevents deactivation attempts on already-deactivating or inactive accounts.
  - `createHandleSelectStakeAccount(account, setSelectedAccount, setModalVisible)` — Pure factory for the tap-to-open handler in PortfolioDashboard. Follows the established pure-logic-extraction pattern to bypass RNTL Pressability constraints.
- **Polyfill chain completion:** Added `@solana/webcrypto-ed25519-polyfill` as step 5 in `polyfill.js` — loaded AFTER `react-native-quick-crypto` so `crypto.subtle` already exists. This polyfill patches `SubtleCrypto` with Ed25519 `generateKey`/`sign`/`verify` support, which is required by `@solana/kit`'s `generateKeyPairSigner()` in the staking transaction flow (Phase 4). Without this polyfill, `generateKeyPairSigner()` throws at runtime because Hermes' native `crypto.subtle` lacks Ed25519 support.

### Polyfill Load Order (Critical)
```
1. react-native-get-random-values      → crypto.getRandomValues
2. react-native-url-polyfill/auto      → URL / URLSearchParams
3. buffer                              → global.Buffer
4. react-native-quick-crypto           → crypto.subtle (install())
5. @solana/webcrypto-ed25519-polyfill  → Ed25519 generateKey/sign/verify
```
Any deviation from this order causes silent runtime failures. The ed25519 polyfill MUST come after quick-crypto because it extends the `crypto.subtle` object that `install()` creates.

### MWA/Solana Complexities Handled
- **ESM import chain isolation in tests:** `StakeManagerModal` imports from `PortfolioDashboard` (for `STAKE_STATE_LABELS`/`getStakeStateColor`), which transitively imports `@solana/kit` (ESM `.mjs`). Tests mock `PortfolioDashboard` to inline labels/colors, breaking the ESM chain while the real component resolves fine via Metro bundling.
- **`@solana/webcrypto-ed25519-polyfill` in test environment:** The package is ESM-native and cannot be loaded in Jest's Node environment. Tests that exercise `generateKeyPairSigner()` mock the function entirely, so the polyfill is irrelevant to the test suite.
- **Deactivation button visibility logic:** `showDeactivateButton('deactivating')` returns `false` — a stake account already in the deactivation queue should not present a second deactivation option. Similarly, `'inactive'` accounts (never activated or fully withdrawn) have nothing to deactivate.

### Test Baseline (109 tests, 19 suites)
Final Phase 6 milestone: 109 tests, 19 suites, all GREEN.

### Implemented Features Summary
- ✅ Connect/disconnect mobile wallet (MWA)
- ✅ SOL balance display
- ✅ Token accounts listing (Token + Token-2022)
- ✅ Validator discovery via `getVoteAccounts` (filtered: excludes 100% commission, sorted: lowest commission first)
- ✅ ValidatorCard component (ellipsified pubkey, commission display, interactive touchable)
- ✅ Dynamic route `[votePubkey]` for per-validator staking
- ✅ On-chain stake delegation transaction (3-instruction flow: create + initialize + delegate)
- ✅ Stake account discovery via `getProgramAccounts` with binary `StakeStateV2` decoding
- ✅ PortfolioDashboard with state-aware color badges (active/activating/deactivating/inactive)
- ✅ Deactivation transaction (single-instruction: `getDeactivateInstruction`)
- ✅ StakeManagerModal (tap-to-open from PortfolioDashboard, conditional deactivate button)
- ✅ Ed25519 environment polyfill for Hermes runtime
- ✅ Tab navigation (Account, Staking, Settings, Demo)
- ✅ Sign-in screen with auth guard routing
- ✅ Light/dark theme support
- ✅ 109 passing tests across 19 suites

---

## 2026-07-20 — MWA Connection Pipeline Fixes: Background Timeout & Handshake Promise

### Architectural Decisions
- **URI must be a real, fast-resolving HTTPS domain.** Phantom performs a background JSON-RPC socket verification against `AppIdentity.uri` with a 30-second timeout. Custom deep-link schemes (e.g., `solanastaker://app`) and non-resolving domains (e.g., `solana-staker-mobile.com`) cause the socket to hang for the full 30 seconds and time out silently — Phantom never presents the connection prompt. Using `https://example.com` (a real, instant-resolving domain) prevents this timeout.
- **Must `await connect()` in the connection callback.** `useMobileWallet().connect()` returns a promise that suspends until Phantom completes its authorization handshake and delivers the return intent via Android's intent system. Firing `connect()` without `await` discards the promise and prevents the app from receiving the authorized account payload.
- **Never route away before `connect()` resolves.** Premature navigation (e.g., `router.replace()` inside a `setTimeout` before the promise settles) unmounts the component holding the MWA promise listener, severing the Android intent-receiving pipeline. Navigation must only occur after `await connect()` completes successfully.

### MWA/Solana Complexities Handled
- **30-second background socket timeout:** Phantom opens a JSON-RPC socket to the `AppIdentity.uri` domain to verify the requesting app's identity. If the domain doesn't resolve, the socket hangs for the full 30 seconds. The fix: set `uri` to `https://example.com` — a real, fast-resolving domain that completes Phantom's verification instantly.
- **JS thread pausing / Android lifecycle:** When `connect()` fires, MWA launches an Android intent that opens Phantom, pausing the React Native app (JS thread suspended). When the user approves/rejects, a return intent resumes the app and the suspended `await connect()` promise resolves with the wallet's payload. The promise must remain alive (component mounted, no navigation away) throughout this entire lifecycle window.
- **`setTimeout` anti-pattern:** Using `setTimeout` to force navigation before `connect()` resolves severs the MWA promise listener. The `account` state never updates because the component holding the listener is unmounted by the premature navigation. The correct pattern is to wait for `await connect()` and only navigate after the promise settles.

### Fixes Applied
- `constants/app-config.ts`: Changed `uri` from `'solanastaker://app'` → `'https://solana-staker-mobile.com'` → `'https://example.com'` (final, fast-resolving domain). Also corrected `name` from `'solana-mobile-staker'` to `'solana-staker-mobile'`.
- `features/account/account-feature-connect.tsx`: Removed `setTimeout` hack, added `useCallback` + `useRouter`, now properly `await`s `connect()` before executing `router.replace('/staking')`.

### Test Baseline
No test regressions — the MWA connection layer is runtime behavior that cannot be unit-tested (Phantom's external process). The pure function extraction pattern for all other staking/wallet logic remains intact.

---

## 2026-07-20 — Phase 7: Circular Dependency Break & Layout Cleanup

### Architectural Decisions
- **Extracted shared staking types into `features/staking/staking-types.ts`.** `PortfolioDashboard` and `StakeManagerModal` had a circular import: `PortfolioDashboard` → imports `StakeManagerModal`, `StakeManagerModal` → imports `STAKE_STATE_LABELS` and `getStakeStateColor` from `PortfolioDashboard`. The shared symbols (`STAKE_STATE_LABELS`, `getStakeStateColor` + underlying `STAKE_STATE_COLORS`) were extracted into a standalone `staking-types.ts` file. Both components now import from `staking-types.ts`, breaking the cycle.
- **`PortfolioDashboard` re-exports `STAKE_STATE_LABELS` and `getStakeStateColor`** for backward compatibility with existing importers (including tests).
- **Removed `StakingFeature` rendering from Account tab.** The Account tab was stacking both `StakingFeature` (validator list) and `PortfolioDashboard` (stake accounts). The `StakingFeature` was cleaned out so the Account tab renders a clean portfolio + balance + tokens view. The validator list remains accessible on the dedicated Staking tab.

### MWA/Solana Complexities Handled
- Circular imports in RN/Expo cause silent module resolution failures that can freeze the entire Metro bundler and crash the app at startup. Extracting shared types to a leaf module is the canonical fix.
- Redundant component stacking (`StakingFeature` + `PortfolioDashboard`) was causing unnecessary re-renders and network calls, slowing wallet session restore.

### Test Baseline
- 19 suites, 119 tests passing (down 1 from 120 due to removal of `StakingFeature` assertion from Account tab test — the component no longer renders there, and the assertion was correctly removed).
- `StakeManagerModal.test.tsx`: mock path updated from `@/features/staking/PortfolioDashboard` → `@/features/staking/staking-types`.
- `account-feature.test.tsx`: removed `StakingFeature` mock and assertion, kept `PortfolioDashboard` mock.

---

## 2026-07-20 — Phase 8: OOM Prevention — Query Enabled Guard + memcmp Authority Filter

### Architectural Decisions
- **`enabled: !!address` guard on `useGetStakeAccounts`.** Without this flag, React Query fires the RPC call immediately on mount — even when `address` is `undefined` (wallet not yet connected). This causes `getProgramAccounts` to fetch the **entire network's stake registry** (thousands of accounts), consuming hundreds of MB and OOM-crashing the mobile process. The `enabled` flag ensures the query stays dormant until the wallet provides a real address.
- **`memcmp` filter on `authorized.withdrawer` at byte offset 44.** In the Stake account layout, the `authorized.withdrawer` pubkey (32 bytes) starts at offset 44 (4 bytes of state enum + 40 bytes of `Authorized` struct header fields: 32-byte staker + 4-byte padding). The filter restricts the RPC response to only accounts where the withdrawer authority matches the user's wallet, changing the query from "download all ~2000 Solana stake accounts" to "return only the user's own stake accounts."
- **`AccountFeature` `address` prop is verified correct.** Line 56 passes `address` (a real JS variable from `account.address`) with an `as Address` cast — not a literal string template. No fix needed on the prop-passing side.

### MWA/Solana Complexities Handled
- **`getProgramAccounts` without filters returns the entire stake registry.** On a public RPC endpoint, this can be thousands of accounts, each 200 bytes encoded. The mobile device's JS engine cannot handle this in a single fetch — it OOMs. The `memcmp` filter at offset 44 (withdrawer authority) is the minimum viable filter for stake account queries.
- **Byte offset 44 calculation** for Stake V2 layout: `data` variant tag (4 bytes) + `meta.authorized.staker` (32 bytes) + `meta.authorized.withdrawer` starts here (32 bytes). The `bytes` field in the filter must be the base58-encoded wallet address.
- **`enabled` flag on `useQuery` is critical in mobile contexts.** Unlike web apps where RPCs are cheap and servers powerful, mobile React Native apps share a single JS thread with the UI and have limited memory. An unfiltered `getProgramAccounts` can freeze the entire device.

### Test Baseline
- 19 suites, 119 tests, 0 failures — no regressions. The mock layer already intercepts `getProgramAccounts` and returns predefined test data regardless of filters, so the addition of `enabled` + `filters` has no impact on existing test assertions.
- The `useGetStakeAccounts` hook test suite (7 tests) continues to pass: the `renderHook` call passes a real `MOCK_STAKER` address, so `enabled: !!address` evaluates to `true` and the query fires normally in tests.

### Fixes Applied
- `features/staking/use-get-stake-accounts.ts`: Added `enabled: !!address` (line 104) and `filters: [{ memcmp: { offset: 44n, bytes: address as string } }]` (lines 116-122).
- `components/account/account-feature.tsx`: Verified line 56 passes real `address` variable — no change needed.
- `README.md`: Updated Portfolio Dashboard feature description to mention memcmp filter and enabled guard.

## 2026-07-22 — Stake SOL Missing Signer Bug Fix

### Root Cause
In `app/(tabs)/staking/[votePubkey].tsx`, the `createHandleStake` function's `getCreateAccountInstruction` call used `payer: stakeKeyPair` (a newly generated keypair with 0 SOL) as the rent payer. The user's connected wallet must fund the stake account creation. Additionally:
- **`stakeAuthority`** in `getDelegateStakeInstruction` was set to `stakeKeyPair` — it should be the user's wallet address (`userAddress`), because the wallet must authorize the delegation
- **`withdrawAuthority`** in `getInitializeCheckedInstruction` was set to `stakeKeyPair` — should be `userAddress` for the same reason

### Fixes Applied
1. **`getCreateAccountInstruction`: `payer`** changed from `stakeKeyPair as any` to `userAddress as any`
2. **`getInitializeCheckedInstruction`: `withdrawAuthority`** changed from `stakeKeyPair as any` to `userAddress as any`
3. **`getDelegateStakeInstruction`: `stakeAuthority`** changed from `stakeKeyPair as any` to `userAddress as any`
4. Test assertions updated to verify `withdrawAuthority: 'user123'` and `stakeAuthority: 'user123'`

### MWA/Solana Complexities
- The `@wallet-ui/react-native-kit` `sendTransactions()` function internally calls `signAndSendTransactionMessageWithSigners()`, which only registers the MWA wallet as fee payer signer — it does not accept additional signer arrays
- All `@solana-program/*` instruction builders return branded `TransactionSigner` nominal types that require `as any` casts for `@solana/kit` v2 compatibility
- The `payer` field in `getCreateAccountInstruction` uses a branded `TransactionSigner<string>` type (feePayer concept), while other account fields use `Address<string>`

### Verification
All 10 votePubkey tests pass: 10 passed, 10 total.
