import { render } from '@testing-library/react-native'
import { useThemeColor } from '@/hooks/use-theme-color'
import { Text } from 'react-native'
import React from 'react'

const mockUseColorScheme = jest.fn()

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => mockUseColorScheme(),
}))

function TestComponent({ light, dark }: { light?: string; dark?: string }) {
  const color = useThemeColor({ light, dark }, 'text')
  return <Text testID="color-value">{color}</Text>
}

describe('useThemeColor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns light theme text color when theme is light', async () => {
    mockUseColorScheme.mockReturnValue('light')
    const { getByTestId } = await render(<TestComponent />)
    expect(getByTestId('color-value')).toHaveTextContent('#11181C')
  })

  it('returns dark theme text color when theme is dark', async () => {
    mockUseColorScheme.mockReturnValue('dark')
    const { getByTestId } = await render(<TestComponent />)
    expect(getByTestId('color-value')).toHaveTextContent('#ECEDEE')
  })

  it('returns light override when theme is light and light prop provided', async () => {
    mockUseColorScheme.mockReturnValue('light')
    const { getByTestId } = await render(<TestComponent light="#custom-light" />)
    expect(getByTestId('color-value')).toHaveTextContent('#custom-light')
  })

  it('returns dark override when theme is dark and dark prop provided', async () => {
    mockUseColorScheme.mockReturnValue('dark')
    const { getByTestId } = await render(<TestComponent dark="#custom-dark" />)
    expect(getByTestId('color-value')).toHaveTextContent('#custom-dark')
  })
})