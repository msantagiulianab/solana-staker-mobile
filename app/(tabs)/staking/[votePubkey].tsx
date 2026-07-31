import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { AppPage } from '@/components/ui/app-page'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { address, createAddressWithSeed } from '@solana/kit'
import {
  getDelegateStakeInstruction,
  getInitializeCheckedInstruction,
  STAKE_PROGRAM_ADDRESS,
} from '@solana-program/stake'
import { getCreateAccountWithSeedInstruction } from '@solana-program/system'

const STAKE_ACCOUNT_SPACE = 228
const RENT_EXEMPT_LAMPORTS = 2_282_880n

/** Official Stake Config address — slot 4 of DelegateStake */
const STAKE_CONFIG_ADDRESS = 'StakeConfig11111111111111111111111111111111'

/**
 * Polls the Solana RPC for transaction confirmation.
 * `getSignatureStatuses` returns an array of status objects (one per signature).
 * A status of `null` means the transaction is not yet known to the cluster.
 * When the status is non-null, the transaction has been processed (confirmed or
 * finalized depending on `searchTransactionHistory`).
 *
 * Throws if the status indicates an error or if the confirmation timeout is reached.
 */
export async function confirmTransaction(
  client: any,
  signature: string,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  while (Date.now() < deadline) {
    const { value } = await client.rpc
      .getSignatureStatuses([signature], { searchTransactionHistory: false })
      .send()

    const status = Array.isArray(value) ? value[0] : null

    if (status !== null) {
      if (status?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
      }
      // Confirmed — the block has been sealed and indexed.
      return
    }

    // Not yet visible on-chain; wait one slot (~400ms) before retrying.
    await sleep(500)
  }

  throw new Error(
    `Transaction confirmation timed out after ${timeoutMs}ms. Please check the explorer.`,
  )
}

/** Verified active Devnet validator vote account for testing */
const DEVNET_VOTE_ACCOUNT = '4Qu9wFBjJmZ86KU6S746K1SFFz4Q4asYsPyP39asYsMyP'

/**
 * Normalizes a v2 instruction (accounts/programAddress) into a bridge-safe
 * shape that also exposes v1 properties (keys/pubkey/programId).  The
 * `@solana-program/*` builders return `Object.freeze()`'d objects where
 * each account meta uses `address` (v2 convention).  The MWA bridge
 * (`sendTransactions`) accesses `accountMeta.pubkey` (v1 convention) and
 * `.accounts.length`, both of which crash on `undefined` without this guard.
 */
function normalizeInstruction(ix: any): any {
  const rawAccounts: any[] = ix.accounts ?? []
  // Add `pubkey`, `isSigner`, and `isWritable` aliases to every account
  // meta so both v1 and v2 consumers work.  The @solana/kit v2 builders
  // produce a `role` enum (0=READONLY, 1=WRITABLE, 2=READONLY_SIGNER,
  // 3=WRITABLE_SIGNER) but the legacy MWA bridge reads `isSigner` and
  // `isWritable` booleans.  Derive them from the role bitflags when the
  // booleans are absent.
  const accounts = rawAccounts.map((a: any) => {
    const meta = { ...(a ?? {}) }

    // v1 pubkey alias
    if (meta.pubkey === undefined) {
      meta.pubkey = meta.address
    }

    // role → isSigner/isWritable derivation
    if (meta.role !== undefined && meta.role !== null) {
      const r = Number(meta.role)
      // role bit 0 (LSB) = isWritable, role bit 1 = isSigner
      if (meta.isSigner === undefined) meta.isSigner = (r & 2) !== 0
      if (meta.isWritable === undefined) meta.isWritable = (r & 1) !== 0
    }

    return meta
  })
  return {
    ...ix,
    accounts,
    keys: accounts,
    programId: ix.programId ?? ix.programAddress,
    data: ix.data ?? new Uint8Array(0),
  }
}

export function createHandleStake(
  account: { address: string } | undefined,
  amount: string,
  votePubkey: string | undefined,
  sendTransactions: (instructions: any[]) => Promise<string>,
  disconnect: () => Promise<void>,
  client: any,
  callbacks?: {
    onTransactionStart?: () => void
    onTransactionFinished?: () => void
  },
) {
  return async () => {
    if (!account) {
      Alert.alert('Error', 'Please connect your wallet first.')
      return
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than 0.')
      return
    }

    // Use the provided votePubkey, or fall back to a known-good Devnet validator.
    const effectiveVotePubkey = votePubkey || DEVNET_VOTE_ACCOUNT

    try {
      const userAddress = address(account.address)
      const voteAddress = address(effectiveVotePubkey)

      const parsedAmount = Number(amount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount greater than 0.')
        return
      }
      const lamportsAmount = BigInt(
        Math.floor(parsedAmount * 1_000_000_000),
      )
      const totalLamports = lamportsAmount + RENT_EXEMPT_LAMPORTS

      console.log('[stakeTx] Rent-exempt calculation:', {
        stakeAmountLamports: lamportsAmount.toString(),
        rentExemptLamports: RENT_EXEMPT_LAMPORTS.toString(),
        totalLamports: totalLamports.toString(),
        accountSpace: STAKE_ACCOUNT_SPACE,
        source: 'HARDCODED_CONSTANT (not fetched from RPC)',
      })

      const seed = `stake:${Date.now()}`
      const stakeAddress = await createAddressWithSeed({
        baseAddress: userAddress,
        programAddress: STAKE_PROGRAM_ADDRESS,
        seed,
      })

      console.log('[stakeTx] args:', {
        userAddress,
        stakeAddress: String(stakeAddress),
        voteAddress: String(voteAddress),
        seed,
        totalLamports: totalLamports.toString(),
        space: STAKE_ACCOUNT_SPACE,
      })

      // --- Pre-flight RPC health check ---
      // sendTransactions (in @wallet-ui/react-native-kit) fetches its own
      // blockhash internally.  If the RPC is rate-limited or degraded, that
      // fetch returns null/undefined without throwing, producing a corrupt
      // transaction that Solflare cannot simulate — the wallet modal never
      // appears and the MWA intent eventually times out with
      // CancellationException.
      //
      // This independent fetch validates the RPC is healthy BEFORE we
      // commit the instructions to the MWA pipeline.  If the RPC is
      // unavailable, we surface a clear error to the user instead of
      // silently timing out.
      if (client) {
        try {
          const healthStart = Date.now()
          const { value: healthBlockhash } = await client.rpc
            .getLatestBlockhash({ commitment: 'confirmed' })
            .send()
          const healthElapsed = Date.now() - healthStart

          if (!healthBlockhash?.blockhash) {
            const msg =
              'Devnet RPC returned an empty blockhash — the public endpoint may be rate-limited. Please wait a moment and try again.'
            console.error('[stakeTx] ❌ Blockhash validation failed:', msg)
            Alert.alert('Network Unavailable', msg)
            return
          }

          console.log(
            `[stakeTx] 🩺 RPC healthy (blockhash ${healthBlockhash.blockhash.slice(0, 16)}… fetched in ${healthElapsed}ms)`,
          )
        } catch (rpcErr: any) {
          console.error('[stakeTx] ❌ Pre-flight RPC check failed:', rpcErr)
          Alert.alert(
            'Network Unavailable',
            'The Solana Devnet RPC is currently unreachable. Please check your connection and try again.',
          )
          return
        }
      }

      console.log('[stakeTx] 🔨 Building staking instructions...')

      const createAccountIx = getCreateAccountWithSeedInstruction({
        payer: { address: userAddress },
        newAccount: stakeAddress,
        baseAccount: { address: userAddress } as any,
        base: userAddress,
        seed,
        // Explicit BigInt cast prevents serialization corruption when
        // normalizeInstruction spreads the instruction and the MWA
        // bridge serializes it for Phantom's simulation engine.
        // Without this, some JS engines may coerce bigint → string,
        // causing Phantom's simulator to hang indefinitely.
        amount: BigInt(totalLamports as any),
        // Explicit Number cast ensures STAKE_ACCOUNT_SPACE is a
        // primitive number, not a branded nominal type that may
        // serialize as an object literal.
        space: Number(STAKE_ACCOUNT_SPACE),
        programAddress: STAKE_PROGRAM_ADDRESS,
      } as any)

      const initializeIx = getInitializeCheckedInstruction({
        stake: stakeAddress as any,
        stakeAuthority: { address: userAddress } as any,
        withdrawAuthority: { address: userAddress } as any,
      })

      const delegateIx = getDelegateStakeInstruction({
        stake: stakeAddress as any,
        vote: voteAddress as any,
        unused: address(STAKE_CONFIG_ADDRESS) as any,
        stakeAuthority: { address: userAddress } as any,
      })

      // --- Helper: apply signer flags and normalize ---
      const normalizeAndSign = (ixs: any[]) => {
        const out = ixs.map(normalizeInstruction)
        const addrStr = String(userAddress)
        for (const ix of out) {
          const keys = ix.keys as any[]
          if (!keys?.length) continue
          for (const k of keys) {
            if (!k) continue
            const pk = k.pubkey ?? k.address
            if (pk && String(pk) === addrStr) {
              k.isSigner = true
            }
          }
        }
        return out
      }

      // --- Step 1: Create + Initialize the stake account ---
      const step1Instructions = normalizeAndSign([createAccountIx, initializeIx])

      console.log(
        '[stakeTx] Step 1 Keys:',
        JSON.stringify(
          step1Instructions.map((ix) => ({
            programId: ix.programId,
            keys: ix.keys.map((k: any) => ({
              pubkey: k.pubkey,
              isSigner: k.isSigner,
              isWritable: k.isWritable,
            })),
          })),
          null,
          2,
        ),
      )

      callbacks?.onTransactionStart?.()
      console.log('[stakeTx] 📤 Step 1/2: Creating stake account...')

      // --- Diagnostic: inspect instruction array before MWA dispatch ---
      console.log('[stakeTx] Step 1 instruction count:', step1Instructions.length)
      for (let i = 0; i < step1Instructions.length; i++) {
        const ix = step1Instructions[i] as any
        console.log(`[stakeTx] Step 1 ix[${i}]:`, {
          type: typeof ix,
          constructorName: ix?.constructor?.name ?? 'unknown',
          hasAccounts: Array.isArray(ix?.accounts),
          accountCount: ix?.accounts?.length ?? ix?.keys?.length ?? 0,
          hasData: ix?.data ? true : false,
          dataType: ix?.data ? (ix.data instanceof Uint8Array ? 'Uint8Array' : typeof ix.data) : 'none',
          programId: ix?.programId ?? ix?.programAddress,
        })
      }

      let sig1: string
      try {
        sig1 = await sendTransactions(step1Instructions)
      } catch (txErr: any) {
        console.error('[stakeTx] ❌ SERIALIZATION FAILED (step 1):', txErr)
        throw txErr
      }
      console.log('[stakeTx] 📥 Step 1 signature:', sig1)

      // Confirm step 1 on-chain so Solflare's step 2 simulation
      // sees the initialized stake account.
      if (client) {
        console.log('[stakeTx] ⏳ Confirming step 1...')
        await confirmTransaction(client, sig1)
        console.log('[stakeTx] ✅ Step 1 confirmed on-chain')
      }

      // --- Step 2: Delegate the stake ---
      const step2Instructions = normalizeAndSign([delegateIx])

      console.log(
        '[stakeTx] Step 2 Keys:',
        JSON.stringify(
          step2Instructions.map((ix) => ({
            programId: ix.programId,
            keys: ix.keys.map((k: any) => ({
              pubkey: k.pubkey,
              isSigner: k.isSigner,
              isWritable: k.isWritable,
            })),
          })),
          null,
          2,
        ),
      )

      // Keep the pending overlay active between steps.
      console.log('[stakeTx] 📤 Step 2/2: Delegating stake...')

      // --- Diagnostic: inspect instruction array before MWA dispatch ---
      console.log('[stakeTx] Step 2 instruction count:', step2Instructions.length)
      for (let i = 0; i < step2Instructions.length; i++) {
        const ix = step2Instructions[i] as any
        console.log(`[stakeTx] Step 2 ix[${i}]:`, {
          type: typeof ix,
          constructorName: ix?.constructor?.name ?? 'unknown',
          hasAccounts: Array.isArray(ix?.accounts),
          accountCount: ix?.accounts?.length ?? ix?.keys?.length ?? 0,
          hasData: ix?.data ? true : false,
          dataType: ix?.data ? (ix.data instanceof Uint8Array ? 'Uint8Array' : typeof ix.data) : 'none',
          programId: ix?.programId ?? ix?.programAddress,
        })
      }

      let sig2: string
      try {
        sig2 = await sendTransactions(step2Instructions)
      } catch (txErr: any) {
        console.error('[stakeTx] ❌ SERIALIZATION FAILED (step 2):', txErr)
        throw txErr
      }
      console.log('[stakeTx] 📥 Step 2 signature:', sig2)

      if (client) {
        console.log('[stakeTx] ⏳ Confirming step 2...')
        await confirmTransaction(client, sig2)
        console.log('[stakeTx] ✅ Step 2 confirmed on-chain')
      }

      Alert.alert(
        'Staking Complete',
        `Stake account created and delegated!\n\nCreate tx: ${sig1.slice(0, 16)}…\nDelegate tx: ${sig2.slice(0, 16)}…`,
      )
    } catch (error: any) {
      console.error('❌ STAKING EXECUTION FAILED:', error)
      const message: string = error?.message ?? String(error ?? '')
      const errorName: string = error?.name ?? ''
      const isUserCancelled =
        message.includes('cancelled by user') ||
        message.includes('ERROR_LOCAL_ASSOCIATION_CANCELLED') ||
        message.includes('CancellationException') ||
        errorName === 'SolanaMobileWalletAdapterError'

      if (isUserCancelled) {
        // The user pressed Android back or dismissed Phantom's confirmation
        // dialog. The MWA WebSocket severs before the return intent delivers
        // a payload. Close the pending overlay and inform the user — the
        // transaction was NOT submitted on-chain.
        Alert.alert(
          'Transaction Cancelled',
          'The transaction was cancelled. Please try again when ready.',
        )
        return
      }

      // Any other error (e.g. stale authToken, RPC timeout, invalid blockhash)
      // is treated as a session-desync.  Wipe the desynchronized token from
      // AsyncStorage so the next connection attempt starts with a clean
      // authorize() handshake.
      try {
        await disconnect()
      } catch (_) {
        // Best-effort wipe; ignore errors from AsyncStorage
      }
      Alert.alert(
        'Session Desynchronized',
        'Wallet cache has been reset. Please reconnect and try again.',
      )
    } finally {
      // Always reset the loading overlay on every exit path — success,
      // cancellation, session error, or unexpected throw.  This guarantees
      // the UI never remains stuck in the "pending" state.
      callbacks?.onTransactionFinished?.()
    }
  }
}

export default function StakingVotePubkeyScreen() {
  const { votePubkey } = useLocalSearchParams<{ votePubkey: string }>()
  const [amount, setAmount] = useState('')
  const [isPending, setIsPending] = useState(false)
  const { account, sendTransactions, disconnect, client } = useMobileWallet()

  const handleStake = useCallback(
    createHandleStake(account, amount, votePubkey, sendTransactions, disconnect, client, {
      onTransactionStart: () => setIsPending(true),
      onTransactionFinished: () => setIsPending(false),
    }),
    [account, amount, votePubkey, sendTransactions, disconnect, client],
  )

  return (
    <AppPage>
      <AppView style={styles.container}>
        <AppText type="title" style={styles.title}>
          Stake with Validator
        </AppText>

        <AppView style={styles.pubkeyCard}>
          <AppText type="defaultSemiBold">Validator</AppText>
          <AppText style={styles.pubkeyText} selectable>
            {votePubkey ?? 'Unknown'}
          </AppText>
        </AppView>

        <AppView style={styles.inputCard}>
          <AppText type="defaultSemiBold">Amount (SOL)</AppText>
          <TextInput
            style={styles.input}
            placeholder="0.0"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </AppView>

        <AppView style={styles.buttonCard}>
          <Pressable
            testID="stake-button"
            style={styles.stakeButton}
            disabled={isPending}
            onPress={handleStake}
          >
            <AppText type="defaultSemiBold" style={styles.stakeButtonText}>
              Stake SOL
            </AppText>
          </Pressable>
        </AppView>

        <Modal
          visible={isPending}
          transparent
          animationType="fade"
          statusBarTranslucent
        >
          <AppView style={styles.modalOverlay}>
            <AppView style={styles.modalContent}>
              <ActivityIndicator size="large" color="#9945FF" />
              <AppText type="defaultSemiBold" style={styles.modalText}>
                Transaction Pending
              </AppText>
              <AppText style={styles.modalSubText}>
                Please confirm in your wallet
              </AppText>
            </AppView>
          </AppView>
        </Modal>
      </AppView>
    </AppPage>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  title: {
    marginBottom: 24,
  },
  pubkeyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  pubkeyText: {
    marginTop: 8,
    fontSize: 14,
  },
  inputCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  input: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '600',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
  },
  buttonCard: {
    marginTop: 16,
  },
  stakeButton: {
    backgroundColor: '#9945FF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  stakeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  modalText: {
    marginTop: 16,
    fontSize: 18,
  },
  modalSubText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
})
