import { render, waitFor } from '@testing-library/react-native'
import React from 'react'

const mockUseLocalSearchParams = jest.fn(() => ({ votePubkey: 'abc123' }))

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}))

jest.mock('@/components/ui/app-page', () => ({
  AppPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

import VotePubkeyScreen from '../[votePubkey]'

describe('Staking [votePubkey] screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocalSearchParams.mockReturnValue({ votePubkey: 'abc123' })
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
})