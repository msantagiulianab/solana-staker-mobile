import { render } from '@testing-library/react-native'
import React from 'react'
import { WalletUiButtonConnect } from '@/components/solana/wallet-ui-button-connect'

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

describe('WalletUiButtonConnect', () => {
  it('renders with default label', async () => {
    const { getByText } = await render(<WalletUiButtonConnect />)
    expect(getByText('Connect')).toBeTruthy()
  })

  it('renders with custom label', async () => {
    const { getByText } = await render(<WalletUiButtonConnect label="Sign In" />)
    expect(getByText('Sign In')).toBeTruthy()
  })
})