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

const STAKE_ACCOUNT_SPACE = 200
const RENT_EXEMPT_LAMPORTS = 2_282_880n

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
  // Add `pubkey` alias to every account meta so both v1 and v2 consumers work.
  const accounts = rawAccounts.map((a: any) => ({
    ...(a ?? {}),
    pubkey: a?.pubkey ?? a?.address,
  }))
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

      const createAccountIx = getCreateAccountWithSeedInstruction({
        payer: { address: userAddress },
        newAccount: stakeAddress,
        base: userAddress,
        seed,
        amount: totalLamports,
        space: STAKE_ACCOUNT_SPACE,
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
        unused: userAddress as any,
        stakeAuthority: { address: userAddress } as any,
      })

      // Normalize every instruction so the MWA bridge always sees:
      //  - `.accounts` / `.keys` as arrays (never undefined)
      //  - each account meta with both `address` (v2) and `pubkey` (v1)
      const instructions = [createAccountIx, initializeIx, delegateIx].map(
        normalizeInstruction,
      )

      // Signal the UI to show the pending overlay BEFORE invoking MWA.
      // If sendTransactions rejects (cancellation, timeout, etc.), the
      // finally block guarantees onTransactionFinished fires to reset UI.
      callbacks?.onTransactionStart?.()

      const signature = await sendTransactions(instructions)

      console.log('[MWA Result Signature]:', signature)

      // Poll for transaction confirmation on-chain before dismissing
      // the pending overlay. MWA's sendTransactions returns a signature
      // as soon as Phantom signs, but the network may take several slots
      // to actually process and seal the block.
      if (client) {
        console.log('[stakeTx] ⏳ Awaiting network confirmation...')
        await confirmTransaction(client, signature)
        console.log('[stakeTx] ✅ Transaction confirmed on-chain')
      }

      Alert.alert('Success', `Transaction sent!\nSignature: ${signature}`)
    } catch (error: any) {
      const message: string = error?.message ?? String(error ?? '')
      const isUserCancelled =
        message.includes('cancelled by user') ||
        message.includes('ERROR_LOCAL_ASSOCIATION_CANCELLED')

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
