# Development Journal

## 2026-07-11 — Project Bootstrap & Utility TDD

### Architectural Decisions
- Using Jest 29.7.0 (downgraded from 30.x) for compatibility with jest-expo 57 and @testing-library/jest-native
- Simplified jest.setup.js to avoid `expect is not defined` errors during setup phase
- Confirmed project already uses `@wallet-ui/react-native-kit` (v2 kit) wrapping `@solana/kit`, NOT legacy `@wallet-ui/react-native-web3js` or `@solana/web3.js` v1
- `src/` directory structure established per kit-expo-minimal conventions

### What Was Tested
- `ellipsify()` utility: 7 test cases (short, at limit, over limit, default delimiter, custom delimiter, empty string, default params)
- `lamportsToSol()` utility: 5 test cases (0 lamports, 1 SOL, 0.5 SOL, 1 lamport, large balance)

### Solana/Wallet Complexities
- The existing `ellipsify` always truncates when `strLen >= limit` (inclusive), not `strLen > limit`. Test expectations adjusted accordingly.
- `lamportsToSol` divides by 1e9 for LAMPORTS_PER_SOL conversion.