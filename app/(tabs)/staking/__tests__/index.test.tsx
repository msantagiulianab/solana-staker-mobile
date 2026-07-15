import { render } from '@testing-library/react-native'
import React from 'react'

jest.mock('@/components/ui/app-page', () => ({
  AppPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/staking/staking-feature', () => ({
  StakingFeature: () => <>{null}</>,
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

import StakingPage from '../index'

describe('Staking page', () => {
  it('renders without crashing', async () => {
    await render(<StakingPage />)
  })
})