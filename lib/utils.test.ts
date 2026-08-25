import { describe, expect, it } from 'vitest'

import { formatPrix } from './utils'

describe('formatPrix', () => {
  it('affiche le prix en dinar tunisien avec 3 décimales (millimes)', () => {
    expect(formatPrix(28)).toBe('28.000 DT')
    expect(formatPrix(12.5)).toBe('12.500 DT')
    expect(formatPrix(0)).toBe('0.000 DT')
  })
})
