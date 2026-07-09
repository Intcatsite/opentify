// Curated colors for well-known genres; anything else falls back to a
// color hashed from its name, so tags stay visually distinct even for
// genres we didn't think to name here (e.g. AI-predicted labels).
const CURATED: Record<string, number> = {
  electronic: 262, // purple
  ambient: 199, // blue
  pop: 330, // pink
  'hip-hop': 25, // orange
  hiphop: 25,
  rock: 0, // red
  metal: 348, // crimson
  jazz: 172, // teal
  classical: 42, // gold
  acoustic: 130, // green
  folk: 130,
  'r&b': 280, // violet
  reggae: 80, // lime
  country: 30, // tan/brown
  soundtrack: 210,
  blues: 210,
}

export function hashHue(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

export function genreColor(genre: string): { bg: string; fg: string } {
  const key = genre.trim().toLowerCase()
  const hue = key in CURATED ? CURATED[key] : hashHue(key)
  return {
    bg: `hsla(${hue}, 75%, 55%, 0.18)`,
    fg: `hsl(${hue}, 85%, 72%)`,
  }
}

/// A stable two-tone gradient for a track's default cover, so untagged
/// tracks still look distinct from one another instead of a flat gray box.
export function coverGradient(seed: string): string {
  const hue = hashHue(seed)
  const hue2 = (hue + 40) % 360
  return `linear-gradient(135deg, hsl(${hue}, 55%, 28%), hsl(${hue2}, 55%, 16%))`
}
