import { render, waitFor } from '@testing-library/react-native'
import React from 'react'

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

import { ValidatorCard } from '@/components/staking/validator-card'

describe('ValidatorCard', () => {
  it('renders the ellipsified votePubkey', async () => {
    const { getByText } = await render(
      <ValidatorCard votePubkey="VeryLongValidatorPubKey123456789" commission={10} />,
    )
    await waitFor(() => expect(getByText('Very..6789')).toBeTruthy())
  })

  it('renders the commission percentage', async () => {
    const { getByText } = await render(
      <ValidatorCard votePubkey="abc123" commission={10} />,
    )
    await waitFor(() => expect(getByText('10%')).toBeTruthy())
  })

  it('renders the "Commission:" label', async () => {
    const { getByText } = await render(
      <ValidatorCard votePubkey="abc123" commission={10} />,
    )
    await waitFor(() => expect(getByText('Commission:')).toBeTruthy())
  })

  it('does not truncate a short votePubkey', async () => {
    const { getByText } = await render(
      <ValidatorCard votePubkey="abc" commission={5} />,
    )
    await waitFor(() => expect(getByText('abc')).toBeTruthy())
  })

  it('renders 0% commission correctly', async () => {
    const { getByText } = await render(
      <ValidatorCard votePubkey="abc123" commission={0} />,
    )
    await waitFor(() => expect(getByText('0%')).toBeTruthy())
  })
})