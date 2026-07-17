/**
 * Deactivate Stake — pure factory function.
 *
 * createHandleDeactivate returns an async handler that:
 *   1. Validates inputs (Alert on missing/invalid)
 *   2. Builds a deactivate instruction via @solana-program/stake
 *   3. Sends the transaction via the MWA sendTransaction function
 *   4. Shows success/failure Alert
 */

import { Alert } from 'react-native'
import { address } from '@solana/kit'
import { getDeactivateInstruction } from '@solana-program/stake'

export function createHandleDeactivate(
  stakeAccountPubkey: string | undefined,
  authorizedPubkey: string | undefined,
  sendTransaction: ((instructions: any[]) => Promise<string>) | undefined,
) {
  return async () => {
    if (!stakeAccountPubkey) {
      Alert.alert('Error', 'Missing stake account to deactivate.')
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

      const deactivateIx = getDeactivateInstruction({
        stake: stakeAddress as any,
        stakeAuthority: { address: authorityAddress } as any,
      })

      const instructions = [deactivateIx]
      const signature = await sendTransaction(instructions)

      Alert.alert(
        'Success',
        `Deactivation transaction sent!\nSignature: ${signature}`,
      )
    } catch (error: any) {
      Alert.alert(
        'Error',
        `Failed to send deactivation transaction: ${error?.message ?? String(error)}`,
      )
    }
  }
}