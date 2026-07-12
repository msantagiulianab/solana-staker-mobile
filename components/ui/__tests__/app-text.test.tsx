import { render } from '@testing-library/react-native'
import React from 'react'
import { AppText } from '@/components/ui/app-text'

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}))

describe('AppText', () => {
  it('renders children', async () => {
    const { getByText } = await render(<AppText>Hello World</AppText>)
    expect(getByText('Hello World')).toBeTruthy()
  })

  it('renders title type with correct fontSize', async () => {
    const { getByText } = await render(<AppText type="title">Title</AppText>)
    const el = getByText('Title')
    expect(el).toBeTruthy()
  })

  it('renders default type', async () => {
    const { getByText } = await render(<AppText>Default</AppText>)
    expect(getByText('Default')).toBeTruthy()
  })
})