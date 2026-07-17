/**
 * Tests for createHandleDeactivate — the pure factory function for
 * deactivating a stake account.
 *
 * Mock strategy: inline mocks for @solana/kit and @solana-program/stake.
 * The factory is tested as a pure function (no React rendering).
 *
 * Architecture:
 *   createHandleDeactivate(stakeAccountPubkey, authorizedPubkey, sendTransaction)
 *   returns an async () => void that:
 *     1. Validates inputs (shows Alert on missing/invalid)
 *     2. Builds a deactivate instruction via getDeactivateInstruction
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
// Mock @solana-program/stake — inline mock for getDeactivateInstruction
// ---------------------------------------------------------------------------
jest.mock('@solana-program/stake', () => ({
  STAKE_PROGRAM_ADDRESS: 'Stake11111111111111111111111111111111111111',
  getDeactivateInstruction: jest.fn(() => ({ __ix: 'deactivate' })),
}))

// Dynamic import after mocks
import { createHandleDeactivate } from '../deactivate-stake'
import { getDeactivateInstruction } from '@solana-program/stake'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const STAKE_ACCOUNT = 'StakeAcct111111111111111111111111111111111'
const AUTHORIZED_PUBKEY = 'WalletUser11111111111111111111111111111111'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

beforeEach(() => {
  jest.mocked(Alert.alert).mockClear()
  jest.mocked(getDeactivateInstruction).mockClear()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('createHandleDeactivate', () => {
  // ----- Validation: missing stake account -----
  it('shows error alert when stakeAccountPubkey is undefined', async () => {
    const handler = createHandleDeactivate(undefined, AUTHORIZED_PUBKEY, jest.fn())
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Missing stake account to deactivate.',
    )
    expect(getDeactivateInstruction).not.toHaveBeenCalled()
  })

  // ----- Validation: missing authorized pubkey -----
  it('shows error alert when authorizedPubkey is undefined', async () => {
    const handler = createHandleDeactivate(STAKE_ACCOUNT, undefined, jest.fn())
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please connect your wallet first.',
    )
    expect(getDeactivateInstruction).not.toHaveBeenCalled()
  })

  // ----- Validation: missing sendTransaction -----
  it('shows error alert when sendTransaction is undefined', async () => {
    const handler = createHandleDeactivate(STAKE_ACCOUNT, AUTHORIZED_PUBKEY, undefined)
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Wallet sendTransaction is not available.',
    )
    expect(getDeactivateInstruction).not.toHaveBeenCalled()
  })

  // ----- Successful deactivation -----
  it('builds deactivate instruction and sends transaction', async () => {
    const mockSend = jest.fn().mockResolvedValue('txDeactivateSigABC')
    const handler = createHandleDeactivate(STAKE_ACCOUNT, AUTHORIZED_PUBKEY, mockSend)
    await handler()

    // Verify instruction built with correct params
    expect(getDeactivateInstruction).toHaveBeenCalledTimes(1)
    expect(getDeactivateInstruction).toHaveBeenCalledWith(
      expect.objectContaining({
        stake: STAKE_ACCOUNT,
        stakeAuthority: expect.objectContaining({
          address: AUTHORIZED_PUBKEY,
        }),
      }),
    )

    // Verify transaction was sent
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  // ----- Success alert -----
  it('shows success alert with transaction signature', async () => {
    const mockSend = jest.fn().mockResolvedValue('txSuccessDeactivateXYZ')
    const handler = createHandleDeactivate(STAKE_ACCOUNT, AUTHORIZED_PUBKEY, mockSend)
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Deactivation transaction sent!\nSignature: txSuccessDeactivateXYZ',
    )
  })

  // ----- Failure alert -----
  it('shows error alert on transaction failure', async () => {
    const mockSend = jest.fn().mockRejectedValue(new Error('User rejected the request'))
    const handler = createHandleDeactivate(STAKE_ACCOUNT, AUTHORIZED_PUBKEY, mockSend)
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to send deactivation transaction: User rejected the request',
    )
  })

  // ----- Edge: empty string stake account -----
  it('shows error alert when stakeAccountPubkey is an empty string', async () => {
    const handler = createHandleDeactivate('', AUTHORIZED_PUBKEY, jest.fn())
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Missing stake account to deactivate.',
    )
    expect(getDeactivateInstruction).not.toHaveBeenCalled()
  })

  // ----- Edge: empty string authorized pubkey -----
  it('shows error alert when authorizedPubkey is an empty string', async () => {
    const handler = createHandleDeactivate(STAKE_ACCOUNT, '', jest.fn())
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please connect your wallet first.',
    )
    expect(getDeactivateInstruction).not.toHaveBeenCalled()
  })

  // ----- Does NOT call sendTransaction when instruction build throws -----
  it('does not call sendTransaction if getDeactivateInstruction throws', async () => {
    jest.mocked(getDeactivateInstruction).mockImplementationOnce(() => {
      throw new Error('Invalid stake account')
    })
    const mockSend = jest.fn()
    const handler = createHandleDeactivate(STAKE_ACCOUNT, AUTHORIZED_PUBKEY, mockSend)
    await handler()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to send deactivation transaction: Invalid stake account',
    )
    expect(mockSend).not.toHaveBeenCalled()
  })
})