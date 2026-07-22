/**
 * Withdraw Stake — pure factory function.
 *
 * createHandleWithdraw returns an async handler that:
 *   1. Validates inputs (Alert on missing/invalid)
 *   2. Builds a withdraw instruction via @solana-program/stake
 *   3. Sweeps the entire deactivated stake account balance (lamports)
 *   4. Sends the transaction via the MWA sendTransaction function
 *   5. Shows success/failure Alert
 */

import { Alert } from 'react-native'
import { address } from '@solana/kit'
import { getWithdrawInstruction } from '@solana-program/stake'

export function createHandleWithdraw(
  stakeAccountPubkey: string | undefined,
  stakeAccountLamports: bigint | undefined,
  authorizedPubkey: string | undefined,
  sendTransaction: ((instructions: any[]) => Promise<string>) | undefined,
) {
  return async () => {
    if (!stakeAccountPubkey) {
      Alert.alert('Error', 'Missing stake account to withdraw from.')
      return
    }

    if (stakeAccountLamports == null || stakeAccountLamports <= 0n) {
      Alert.alert('Error', 'Stake account has zero balance to withdraw.')
      return
    }

    if (!authorizedPubkey) {
      Alert.alert('Error', 'Please connect your wallet first.')
      return
    }

    if (!sendTransaction) {
      Alert.alert('Error', 'Wallet sendTransaction is not available.')
      return
    }

    try {
      const stakeAddress = address(stakeAccountPubkey)
      const authorityAddress = address(authorizedPubkey)
      const recipientAddress = address(authorizedPubkey) // sweep to connected wallet

      const withdrawIx = getWithdrawInstruction({
        stake: stakeAddress,
        withdrawAuthority: { address: authorityAddress },
        recipient: recipientAddress,
        lamports: stakeAccountLamports,
      } as any)

      const instructions = [withdrawIx]
      const signature = await sendTransaction(instructions)

      Alert.alert(
        'Success',
        `Withdraw transaction sent!\nSignature: ${signature}`,
      )
      return signature
    } catch (error: any) {
      Alert.alert(
        'Error',
        `Failed to send withdraw transaction: ${error?.message ?? String(error)}`,
      )
      throw error
    }
  }
}