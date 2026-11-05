import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Dinar tunisien : 1 DT = 1000 millimes, d'où les 3 décimales d'usage.
export function formatPrix(value: number) {
  return `${value.toFixed(3)} DT`
}

/** Borne une valeur dans [min, max]. */
export function borner(valeur: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, valeur))
}
