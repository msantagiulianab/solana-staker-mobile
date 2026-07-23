/**
 * Tests for createHandleWithdraw — the pure factory function for
 * withdrawing deactivated stake lamports to the authorized wallet.
 *
 * Mock strategy: inline mocks for @solana/kit and @solana-program/stake.
 * The factory is tested as a pure function (no React rendering).
 *
 * Architecture:
 *   createHandleWithdraw(stakeAccountPubkey, stakeAccountLamports, authorizedPubkey, sendTransaction)
 *   returns an async () => string | void that:
 *     1. Validates inputs (shows Alert on missing/invalid)
 *     2. Builds a withdraw instruction via getWithdrawInstruction
 *     3. Sends the transaction via sendTransaction
 *     4. Shows success/failure Alert
 */

import { Alert } from 'react-native'

// ---------------------------------------------------------------------------
// Mock @solana/kit — inline identity mocks to satisfy branded types
// ---------------------------------------------------------------------------
jest.mock('@solana/kit', () => ({
  address: (s: string) => s,
  sol: (s: string) => s,
  solToLamports: () => 1_000_000_000n,
}))

// ---------------------------------------------------------------------------
// Mock @solana-program/stake — inline mock for getWithdrawInstruction
// ---------------------------------------------------------------------------
jest.mock('@solana-program/stake', () => ({
  getWithdrawInstruction: jest.fn(() => ({ __ix: 'withdraw' })),
}))

// Dynamic import after mocks
import { createHandleWithdraw } from '../withdraw-stake'
import { getWithdrawInstruction } from '@solana-program/stake'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const STAKE_ACCOUNT = 'StakeAcct111111111111111111111111111111111'
const AUTHORIZED_PUBKEY = 'WalletUser11111111111111111111111111111111'
const LAMPORTS = 1_000_000_000n

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

beforeEach(() => {
  jest.mocked(Alert.alert).mockClear()
  jest.mocked(getWithdrawInstruction).mockClear()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('createHandleWithdraw', () => {
  // ----- Validation: missing stake account (undefined) -----
  it('shows error alert when stakeAccountPubkey is undefined', async () => {
    const handler = createHandleWithdraw(
      undefined,
      LAMPORTS,
      AUTHORIZED_PUBKEY,
      jest.fn(),
    )
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Missing stake account to withdraw from.',
    )
    expect(getWithdrawInstruction).not.toHaveBeenCalled()
  })

  // ----- Validation: empty string stake account -----
  it('shows error alert when stakeAccountPubkey is an empty string', async () => {
    const handler = createHandleWithdraw('', LAMPORTS, AUTHORIZED_PUBKEY, jest.fn())
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Missing stake account to withdraw from.',
    )
    expect(getWithdrawInstruction).not.toHaveBeenCalled()
  })

  // ----- Validation: lamports is null, zero, or negative -----
  it('shows error alert when stakeAccountLamports is null, zero, or negative', async () => {
    // null
    let handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      null as unknown as bigint,
      AUTHORIZED_PUBKEY,
      jest.fn(),
    )
    await handler()
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Stake account has zero balance to withdraw.',
    )
    jest.mocked(Alert.alert).mockClear()

    // zero
    handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      0n,
      AUTHORIZED_PUBKEY,
      jest.fn(),
    )
    await handler()
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Stake account has zero balance to withdraw.',
    )
    jest.mocked(Alert.alert).mockClear()

    // negative
    handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      -1n,
      AUTHORIZED_PUBKEY,
      jest.fn(),
    )
    await handler()
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Stake account has zero balance to withdraw.',
    )

    expect(getWithdrawInstruction).not.toHaveBeenCalled()
  })

  // ----- Validation: missing authorized pubkey (undefined) -----
  it('shows error alert when authorizedPubkey is undefined', async () => {
    const handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      LAMPORTS,
      undefined,
      jest.fn(),
    )
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please connect your wallet first.',
    )
    expect(getWithdrawInstruction).not.toHaveBeenCalled()
  })

  // ----- Validation: empty string authorized pubkey -----
  it('shows error alert when authorizedPubkey is an empty string', async () => {
    const handler = createHandleWithdraw(STAKE_ACCOUNT, LAMPORTS, '', jest.fn())
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please connect your wallet first.',
    )
    expect(getWithdrawInstruction).not.toHaveBeenCalled()
  })

  // ----- Validation: missing sendTransaction -----
  it('shows error alert when sendTransaction is undefined', async () => {
    const handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      LAMPORTS,
      AUTHORIZED_PUBKEY,
      undefined,
    )
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Wallet sendTransaction is not available.',
    )
    expect(getWithdrawInstruction).not.toHaveBeenCalled()
  })

  // ----- Structural: instruction built with correct parameter shapes -----
  it('constructs withdraw instruction with accurate parameter shapes', async () => {
    const mockSend = jest.fn().mockResolvedValue('txWithdrawSigXYZ')
    const handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      LAMPORTS,
      AUTHORIZED_PUBKEY,
      mockSend,
    )
    await handler()

    expect(getWithdrawInstruction).toHaveBeenCalledTimes(1)
    expect(getWithdrawInstruction).toHaveBeenCalledWith(
      expect.objectContaining({
        stake: STAKE_ACCOUNT,
        withdrawAuthority: expect.objectContaining({
          address: AUTHORIZED_PUBKEY,
        }),
        recipient: AUTHORIZED_PUBKEY,
        lamports: LAMPORTS,
      }),
    )

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  // ----- Success flow: resolved signature triggers success alert -----
  it('shows success alert with resolved transaction signature', async () => {
    const mockSend = jest.fn().mockResolvedValue('txWithdrawSuccessABC')
    const handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      LAMPORTS,
      AUTHORIZED_PUBKEY,
      mockSend,
    )
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Withdraw transaction sent!\nSignature: txWithdrawSuccessABC',
    )
  })

  // ----- Error resilience: sendTransaction rejects (rethrow propagated) -----
  it('gracefully intercepts sendTransaction rejection', async () => {
    const mockSend = jest
      .fn()
      .mockRejectedValue(new Error('User rejected the request'))
    const handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      LAMPORTS,
      AUTHORIZED_PUBKEY,
      mockSend,
    )

    try {
      await handler()
      // If handler doesn't throw, test should still verify the alert
    } catch (_) {
      // Rejection propagates because withdraw-stake.ts rethrows
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to send withdraw transaction: User rejected the request',
    )
  })

  // ----- Error resilience: getWithdrawInstruction throws (rethrow propagated) -----
  it('does not call sendTransaction if getWithdrawInstruction throws', async () => {
    jest.mocked(getWithdrawInstruction).mockImplementationOnce(() => {
      throw new Error('Invalid stake account state')
    })
    const mockSend = jest.fn()
    const handler = createHandleWithdraw(
      STAKE_ACCOUNT,
      LAMPORTS,
      AUTHORIZED_PUBKEY,
      mockSend,
    )

    try {
      await handler()
      // If handler doesn't throw, test should still verify the alert
    } catch (_) {
      // Instruction-build error propagates because withdraw-stake.ts rethrows
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to send withdraw transaction: Invalid stake account state',
    )
    expect(mockSend).not.toHaveBeenCalled()
  })
})