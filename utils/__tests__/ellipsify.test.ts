import { ellipsify } from '@/utils/ellipsify'

describe('ellipsify', () => {
  it('returns the original string when shorter than limit', () => {
    expect(ellipsify('abc')).toBe('abc')
  })

  it('truncates the string when exactly at limit', () => {
    // len=4, delimiter='..', limit = 4*2 + 2 = 10
    // string of length 10 should be truncated (>= limit)
    expect(ellipsify('1234567890', 4)).toBe('1234..7890')
  })

  it('truncates string when over limit', () => {
    // len=4, delimiter='..', limit = 10
    // string of length 11: '12345678901' -> '1234..8901'
    expect(ellipsify('12345678901', 4)).toBe('1234..8901')
  })

  it('uses default delimiter', () => {
    // default len=4, delimiter='..', limit=10
    // '12345678901' -> '1234..8901'
    expect(ellipsify('12345678901')).toBe('1234..8901')
  })

  it('uses custom delimiter', () => {
    // len=4, delimiter='...', limit=11
    expect(ellipsify('123456789012', 4, '...')).toBe('1234...9012')
  })

  it('handles empty string', () => {
    expect(ellipsify('')).toBe('')
  })

  it('handles default params on a short string', () => {
    expect(ellipsify('hello')).toBe('hello')
  })
})