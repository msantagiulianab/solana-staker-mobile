import { render } from '@testing-library/react-native'
import React from 'react'
import { StakingFeature } from '@/components/staking/staking-feature'

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

describe('StakingFeature', () => {
  it('renders without crashing', async () => {
    const { getByText } = await render(<StakingFeature />)
    expect(getByText('Staking')).toBeTruthy()
  })

  it('displays the coming soon message', async () => {
    const { getByText } = await render(<StakingFeature />)
    expect(
      getByText('Staking coming soon. Stake SOL to secure the network and earn rewards.'),
    ).toBeTruthy()
  })
})