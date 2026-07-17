// === POLYFILL ORDER IS CRITICAL ===
// These globals MUST be available before @solana/kit or any Solana library is imported.
// The @noble/* cryptography libraries used by @solana/kit require:
//   1. crypto.getRandomValues → provided by react-native-get-random-values
//   2. URL / URLSearchParams → provided by react-native-url-polyfill
//   3. Buffer → polyfilled from the 'buffer' package
//   4. crypto (for hash functions) → provided by react-native-quick-crypto

// 1. getRandomValues (before anything that touches crypto)
import 'react-native-get-random-values'

// 2. URL polyfill (before any fetch or URL parsing)
import 'react-native-url-polyfill/auto'

// 3. Buffer global
import { Buffer } from 'buffer'
global.Buffer = global.Buffer || Buffer

// 4. Quick crypto (provides crypto.subtle and hash functions)
import { install } from 'react-native-quick-crypto'
install()

// 5. Ed25519 key generation polyfill (required by @solana/kit's generateKeyPairSigner)
//    Must load AFTER react-native-quick-crypto so crypto.subtle exists.
//    Patches SubtleCrypto with Ed25519 generateKey/sign/verify support.
import '@solana/webcrypto-ed25519-polyfill'
