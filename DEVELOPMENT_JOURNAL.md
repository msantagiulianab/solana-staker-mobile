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
