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
  generateKeyPairSigner: jest.fn(() =>
    Promise.resolve({ address: 'stakeAcctAddress', keyPair: {}, signMessages: jest.fn(), signTransactions: jest.fn() }),
  ),
  address: (s: string) => s,
  sol: (s: string) => s,
  solToLamports: () => 1_500_000_000n,
}))

jest.mock('@solana-program/stake', () => ({
  STAKE_PROGRAM_ADDRESS: 'Stake11111111111111111111111111111111111111',
  getInitializeCheckedInstruction: jest.fn(() => ({ __ix: 'init' })),
  getDelegateStakeInstruction: jest.fn(() => ({ __ix: 'delegate' })),
}))

jest.mock('@solana-program/system', () => ({
  getCreateAccountInstruction: jest.fn(() => ({ __ix: 'create' })),
}))

jest.mock('@/components/ui/app-page', () => ({
  AppPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

import VotePubkeyScreen, { createHandleStake } from '../[votePubkey]'
import { generateKeyPairSigner } from '@solana/kit'
import { getInitializeCheckedInstruction, getDelegateStakeInstruction } from '@solana-program/stake'
import { getCreateAccountInstruction } from '@solana-program/system'

describe('Staking [votePubkey] screen', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ votePubkey: 'abc123' })
    jest.mocked(Alert.alert).mockClear()
    jest.mocked(generateKeyPairSigner).mockClear()
    jest.mocked(getCreateAccountInstruction).mockClear()
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
    const handleStake = createHandleStake(undefined, '', undefined, jest.fn())
    await handleStake()
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please connect your wallet first.')
  })

  it('shows error alert when amount is zero or invalid', async () => {
    const handleStake = createHandleStake({ address: 'user123' }, '0', 'vote123', jest.fn())
    await handleStake()
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid amount greater than 0.')
  })

  it('shows error alert when votePubkey is missing', async () => {
    const handleStake = createHandleStake({ address: 'user123' }, '1.5', undefined, jest.fn())
    await handleStake()
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Missing validator vote account.')
  })

  it('builds and sends the correct staking transaction', async () => {
    const mockSend = jest.fn().mockResolvedValue('txSig555')
    const handleStake = createHandleStake({ address: 'user123' }, '1.5', 'voteAddrABC', mockSend)
    await handleStake()

    expect(generateKeyPairSigner).toHaveBeenCalledTimes(1)
    expect(getCreateAccountInstruction).toHaveBeenCalledWith(
      expect.objectContaining({ lamports: 1_502_282_880n, space: 200 }),
    )
    expect(getInitializeCheckedInstruction).toHaveBeenCalledWith(
      expect.objectContaining({ stake: 'stakeAcctAddress', stakeAuthority: 'user123', withdrawAuthority: 'user123' }),
    )
    expect(getDelegateStakeInstruction).toHaveBeenCalledWith(
      expect.objectContaining({ vote: 'voteAddrABC', stakeAuthority: 'user123' }),
    )
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('shows success alert with transaction signature', async () => {
    const mockSend = jest.fn().mockResolvedValue('txSuccessABC')
    const handleStake = createHandleStake({ address: 'user123' }, '1', 'voteAddrABC', mockSend)
    await handleStake()

    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Transaction sent!\nSignature: txSuccessABC')
  })

  it('shows error alert on transaction failure', async () => {
    const mockSend = jest.fn().mockRejectedValue(new Error('User rejected'))
    const handleStake = createHandleStake({ address: 'user123' }, '1', 'voteAddrABC', mockSend)
    await handleStake()

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to send transaction: User rejected')
  })
})