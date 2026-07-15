import { render } from '@testing-library/react-native'
import React from 'react'

jest.mock('expo-router', () => {
  const MockTabs = ({ children }: { children: React.ReactNode }) => <>{children}</>
  MockTabs.Screen = () => null
  return { Tabs: MockTabs }
})

jest.mock('@/components/ui/ui-icon-symbol', () => ({
  UiIconSymbol: () => null,
}))

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: () => '#000000',
}))

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

import TabLayout from '../_layout'

describe('Tab layout', () => {
  it('renders without crashing', async () => {
    await render(<TabLayout />)
  })
})