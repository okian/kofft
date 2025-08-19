export function fuzzyScore(pattern: string, text: string): number {
  pattern = pattern.toLowerCase()
  text = text.toLowerCase()
  let score = 0
  let ti = 0
  for (let pi = 0; pi < pattern.length; pi++) {
    const found = text.indexOf(pattern[pi], ti)
    if (found === -1) return Infinity
    score += found - ti
    ti = found + 1
  }
  return score
}

export function fuzzyMatch(pattern: string, text: string): boolean {
  return fuzzyScore(pattern, text) !== Infinity
}
