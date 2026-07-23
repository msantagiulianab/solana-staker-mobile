import React, { useCallback, useState } from 'react'
import { Alert, Pressable, StyleSheet, TextInput } from 'react-native'
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
 * Normalizes a v2 instruction (accounts/programAddress) into a bridge-safe
 * shape that also exposes v1 keys (keys/programId).  The MWA bridge
 * internally accesses `.accounts.length`; without this guard, `as any`-
 * cast inputs can yield instructions where `accounts` is `undefined`.
 */
function normalizeInstruction(ix: any): any {
  return {
    ...ix,
    accounts: ix.accounts ?? [],
    keys: ix.keys ?? ix.accounts ?? [],
    programId: ix.programId ?? ix.programAddress,
  }
}

export function createHandleStake(
  account: { address: string } | undefined,
  amount: string,
  votePubkey: string | undefined,
  sendTransactions: (instructions: any[]) => Promise<string>,
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

    if (!votePubkey) {
      Alert.alert('Error', 'Missing validator vote account.')
      return
    }

    try {
      const userAddress = address(account.address)
      const voteAddress = address(votePubkey)

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
      } as any)

      const initializeIx = getInitializeCheckedInstruction({
        stake: stakeAddress as any,
        stakeAuthority: { address: userAddress } as any,
        withdrawAuthority: userAddress as any,
      })

      const delegateIx = getDelegateStakeInstruction({
        stake: stakeAddress as any,
        vote: voteAddress as any,
        unused: userAddress as any,
        stakeAuthority: { address: userAddress } as any,
      })

      // Normalize every instruction so the MWA bridge always sees
      // `.accounts` as an array (never undefined).  Crashes like
      // "Cannot read property 'length' of undefined" originate when
      // `as any`-cast inputs produce v2 instructions whose internal
      // accounts property is missing or stripped by the transport.
      const instructions = [createAccountIx, initializeIx, delegateIx].map(
        normalizeInstruction,
      )
      const signature = await sendTransactions(instructions)

      Alert.alert('Success', `Transaction sent!\nSignature: ${signature}`)
    } catch (error: any) {
      Alert.alert('Error', `Failed to send transaction: ${error?.message ?? String(error)}`)
    }
  }
}

export default function StakingVotePubkeyScreen() {
  const { votePubkey } = useLocalSearchParams<{ votePubkey: string }>()
  const [amount, setAmount] = useState('')
  const { account, sendTransactions } = useMobileWallet()

  const handleStake = useCallback(
    createHandleStake(account, amount, votePubkey, sendTransactions),
    [account, amount, votePubkey, sendTransactions],
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
            onPress={handleStake}
          >
            <AppText type="defaultSemiBold" style={styles.stakeButtonText}>
              Stake SOL
            </AppText>
          </Pressable>
        </AppView>
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
})