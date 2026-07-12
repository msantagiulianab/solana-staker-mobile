import { lamportsToSol } from '@/utils/lamports-to-sol'

describe('lamportsToSol', () => {
  it('returns 0 SOL for 0 lamports', () => {
    expect(lamportsToSol(0n)).toBe(0)
  })

  it('returns 1 SOL for 1e9 lamports', () => {
    expect(lamportsToSol(1_000_000_000n)).toBe(1)
  })

  it('returns 0.5 SOL for 500_000_000 lamports', () => {
    expect(lamportsToSol(500_000_000n)).toBe(0.5)
  })

  it('returns small value for 1 lamport', () => {
    expect(lamportsToSol(1n)).toBe(1e-9)
  })

  it('handles large balances', () => {
    expect(lamportsToSol(123_456_789_012_345n)).toBe(123456.789012345)
  })
})