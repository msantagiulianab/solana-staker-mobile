import { normalizeColorScheme } from '@/hooks/use-color-scheme'

describe('normalizeColorScheme', () => {
  it('returns light for null', () => {
    expect(normalizeColorScheme(null)).toBe('light')
  })

  it('returns light for undefined', () => {
    expect(normalizeColorScheme(undefined as unknown as string)).toBe('light')
  })

  it('returns light for light', () => {
    expect(normalizeColorScheme('light')).toBe('light')
  })

  it('returns dark for dark', () => {
    expect(normalizeColorScheme('dark')).toBe('dark')
  })

  it('returns light for unspecified', () => {
    // React Native may return 'unspecified' on some platforms
    const result = normalizeColorScheme('unspecified')
    expect(result).toBe('light')
  })
})