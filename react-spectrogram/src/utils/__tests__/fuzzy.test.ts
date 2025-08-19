import { fuzzyMatch, fuzzyScore } from '../fuzzy'

describe('fuzzy utils', () => {
  it('matches subsequences and scores gaps', () => {
    expect(fuzzyMatch('abc', 'a-b-c')).toBe(true)
    expect(fuzzyScore('abc', 'a-b-c')).toBe(2)
  })

  it('returns Infinity when no match', () => {
    expect(fuzzyScore('abc', 'ac')).toBe(Infinity)
    expect(fuzzyMatch('abc', 'ac')).toBe(false)
  })
})
