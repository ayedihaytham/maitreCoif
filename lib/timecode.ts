/**
 * Timecode de cinéma (HH:MM:SS:FF) : l'accueil se lit comme un film de 2 min,
 * le défilement est la tête de lecture (cf. components/site/cinema.tsx).
 */
export const FPS = 24

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

export function formatTimecode(secondes: number, fps: number = FPS): string {
  const images = Math.max(0, Math.floor(secondes * fps))
  const ff = images % fps
  const s = Math.floor(images / fps) % 60
  const m = Math.floor(images / (fps * 60)) % 60
  const h = Math.floor(images / (fps * 3600))
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(ff)}`
}

/** Borne une valeur dans [min, max]. */
export function borner(valeur: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, valeur))
}
