import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import React from 'react'
import { AppTheme } from '@/providers/app-theme'

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

function Child() {
  return <Text testID="child">Themed</Text>
}

describe('AppTheme', () => {
  it('renders children', async () => {
    const { getByTestId } = await render(
      <AppTheme>
        <Child />
      </AppTheme>,
    )
    expect(getByTestId('child')).toHaveTextContent('Themed')
  })
})