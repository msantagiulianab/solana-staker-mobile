import { render, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import React from 'react'

const mockUseLocalSearchParams = jest.fn(() => ({ votePubkey: 'abc123' }))

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}))

jest.mock('@wallet-ui/react-native-kit', () => ({
  useMobileWallet: () => ({
    account: undefined,
    sendTransactions: jest.fn(),
  }),
}))

jest.mock('@solana/kit', () => ({
  createAddressWithSeed: jest.fn(() =>
    Promise.resolve('derivedStakeAcctAddr'),
  ),
  address: (s: string) => s,
}))

jest.mock('@solana-program/stake', () => ({
  STAKE_PROGRAM_ADDRESS: 'Stake11111111111111111111111111111111111111',
  getInitializeCheckedInstruction: jest.fn(() => ({ __ix: 'init' })),
  getDelegateStakeInstruction: jest.fn(() => ({ __ix: 'delegate' })),
}))

jest.mock('@solana-program/system', () => ({
  getCreateAccountWithSeedInstruction: jest.fn(() => ({ __ix: 'createWithSeed' })),
}))

jest.mock('@/components/ui/app-page', () => ({
  AppPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

import VotePubkeyScreen, { createHandleStake } from '../[votePubkey]'
import { createAddressWithSeed } from '@solana/kit'
import { getInitializeCheckedInstruction, getDelegateStakeInstruction } from '@solana-program/stake'
import { getCreateAccountWithSeedInstruction } from '@solana-program/system'

describe('Staking [votePubkey] screen', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ votePubkey: 'abc123' })
    jest.mocked(Alert.alert).mockClear()
    jest.mocked(createAddressWithSeed).mockClear()
    jest.mocked(getCreateAccountWithSeedInstruction).mockClear()
    jest.mocked(getInitializeCheckedInstruction).mockClear()
    jest.mocked(getDelegateStakeInstruction).mockClear()
  })

  beforeAll(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  it('renders the votePubkey header', async () => {
    const { getByText } = await render(<VotePubkeyScreen />)
    await waitFor(() => expect(getByText('Stake with Validator')).toBeTruthy())
  })

  it('displays the full votePubkey from params', async () => {
    const { getByText } = await render(<VotePubkeyScreen />)
    await waitFor(() => expect(getByText('abc123')).toBeTruthy())
  })

  it('renders the SOL amount TextInput', async () => {
    const { getByPlaceholderText } = await render(<VotePubkeyScreen />)
    await waitFor(() => expect(getByPlaceholderText('0.0')).toBeTruthy())
  })

  it('renders the Stake SOL button', async () => {
    const { getByText } = await render(<VotePubkeyScreen />)
    await waitFor(() => expect(getByText('Stake SOL')).toBeTruthy())
  })

  it('shows error alert when user is not connected', async () => {
    const handleStake = createHandleStake(undefined, '', undefined, jest.fn(), jest.fn())
    await handleStake()
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please connect your wallet first.')
  })

  it('shows error alert when amount is zero or invalid', async () => {
    const handleStake = createHandleStake({ address: 'user123' }, '0', 'vote123', jest.fn(), jest.fn())
    await handleStake()
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid amount greater than 0.')
  })

  it('uses devnet fallback when votePubkey is missing', async () => {
    const mockSend = jest.fn().mockResolvedValue('txFallback')
    const handleStake = createHandleStake({ address: 'user123' }, '1.5', undefined, mockSend, jest.fn())
    await handleStake()
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('builds and sends the correct staking transaction', async () => {
    const mockSend = jest.fn().mockResolvedValue('txSig555')
    const handleStake = createHandleStake({ address: 'user123' }, '1.5', 'voteAddrABC', mockSend, jest.fn())
    await handleStake()

    expect(createAddressWithSeed).toHaveBeenCalledTimes(1)
    expect(getCreateAccountWithSeedInstruction).toHaveBeenCalledWith(
      expect.objectContaining({
        newAccount: 'derivedStakeAcctAddr',
        base: 'user123',
        amount: 1_502_282_880n,
        space: 200,
      }),
    )
    expect(getInitializeCheckedInstruction).toHaveBeenCalledWith(
      expect.objectContaining({
        stake: 'derivedStakeAcctAddr',
        stakeAuthority: { address: 'user123' },
        withdrawAuthority: { address: 'user123' },
      }),
    )
    expect(getDelegateStakeInstruction).toHaveBeenCalledWith(
      expect.objectContaining({
        vote: 'voteAddrABC',
        stakeAuthority: { address: 'user123' },
      }),
    )
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('shows success alert with transaction signature', async () => {
    const mockSend = jest.fn().mockResolvedValue('txSuccessABC')
    const handleStake = createHandleStake({ address: 'user123' }, '1', 'voteAddrABC', mockSend, jest.fn())
    await handleStake()

    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Transaction sent!\nSignature: txSuccessABC')
  })

  it('wipes stale token and alerts on send failure', async () => {
    const mockSend = jest.fn().mockRejectedValue(new Error('Session expired'))
    const mockDisconnect = jest.fn().mockResolvedValue(undefined)
    const handleStake = createHandleStake({ address: 'user123' }, '1', 'voteAddrABC', mockSend, mockDisconnect)
    await handleStake()

    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenCalledWith(
      'Session Desynchronized',
      'Wallet cache has been reset. Please reconnect and try again.',
    )
  })

  it('shows pending alert on user cancellation (back button)', async () => {
    const mockSend = jest.fn().mockRejectedValue(
      new Error('Local association cancelled by user'),
    )
    const mockDisconnect = jest.fn().mockResolvedValue(undefined)
    const handleStake = createHandleStake({ address: 'user123' }, '1', 'voteAddrABC', mockSend, mockDisconnect)
    await handleStake()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Transaction Pending',
      'Please check your wallet history to confirm execution.',
    )
    // Must NOT wipe the auth token — the session is still valid
    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it('shows pending alert on ERROR_LOCAL_ASSOCIATION_CANCELLED code', async () => {
    const mockSend = jest.fn().mockRejectedValue(
      new Error('ERROR_LOCAL_ASSOCIATION_CANCELLED: socket closed'),
    )
    const mockDisconnect = jest.fn().mockResolvedValue(undefined)
    const handleStake = createHandleStake({ address: 'user123' }, '1', 'voteAddrABC', mockSend, mockDisconnect)
    await handleStake()

    expect(Alert.alert).toHaveBeenCalledWith(
      'Transaction Pending',
      'Please check your wallet history to confirm execution.',
    )
    expect(mockDisconnect).not.toHaveBeenCalled()
  })
})
