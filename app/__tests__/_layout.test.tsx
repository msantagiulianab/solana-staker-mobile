import { render } from '@testing-library/react-native'
import React from 'react'

// ---- Mocks ----

const mockReplace = jest.fn()
const mockUseSegments = jest.fn(() => ['(tabs)', 'staking'])

jest.mock('expo-router', () => {
  // Must define inside factory because jest.mock factories are hoisted above const declarations
  const MockStack = ({ children }: { children: React.ReactNode }) => <>{children}</>
  MockStack.Screen = () => null
  MockStack.Group = () => null
  return {
    Stack: MockStack,
    useRouter: () => ({ replace: mockReplace }),
    useSegments: () => mockUseSegments(),
  }
})

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}))

jest.mock('@wallet-ui/react-native-kit', () => ({
  useMobileWallet: jest.fn(),
}))

jest.mock('react-native-reanimated', () => ({
  default: {
    createAnimatedComponent: (component: unknown) => component,
  },
}))

jest.mock('@/components/app-providers', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Dynamically import after mocks are hoisted
import RootLayoutDefault from '../_layout'

const { useMobileWallet } = require('@wallet-ui/react-native-kit')

describe('RootLayout auth guard routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReplace.mockClear()
    mockUseSegments.mockImplementation(() => ['(tabs)', 'staking'])
    useMobileWallet.mockReturnValue({ account: null })
  })

  it('renders without crashing', async () => {
    useMobileWallet.mockReturnValue({ account: undefined })
    mockUseSegments.mockImplementation(() => ['(tabs)', 'staking'])

    await render(<RootLayoutDefault />)
  })

  it('redirects to /sign-in when unauthenticated and inside tabs group', async () => {
    useMobileWallet.mockReturnValue({ account: null })
    mockUseSegments.mockImplementation(() => ['(tabs)', 'staking'])

    await render(<RootLayoutDefault />)

    expect(mockReplace).toHaveBeenCalledWith('/sign-in')
  })

  it('does NOT redirect when authenticated and inside tabs group', async () => {
    useMobileWallet.mockReturnValue({ account: { address: 'abc' } })
    mockUseSegments.mockImplementation(() => ['(tabs)', 'staking'])

    await render(<RootLayoutDefault />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to /staking when authenticated and NOT inside tabs group', async () => {
    useMobileWallet.mockReturnValue({ account: { address: 'abc' } })
    mockUseSegments.mockImplementation(() => ['sign-in'])

    await render(<RootLayoutDefault />)

    expect(mockReplace).toHaveBeenCalledWith('/staking')
  })

  it('does NOT redirect when unauthenticated and NOT inside tabs group', async () => {
    useMobileWallet.mockReturnValue({ account: null })
    mockUseSegments.mockImplementation(() => ['sign-in'])

    await render(<RootLayoutDefault />)

    expect(mockReplace).not.toHaveBeenCalled()
  })
})