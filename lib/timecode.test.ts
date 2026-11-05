import { describe, expect, it } from 'vitest'

import { borner, formatTimecode } from './timecode'

describe('formatTimecode (24 images par seconde)', () => {
  it('commence à zéro et ne descend jamais sous zéro', () => {
    expect(formatTimecode(0)).toBe('00:00:00:00')
    expect(formatTimecode(-5)).toBe('00:00:00:00')
  })

  it('compte les images dans la seconde', () => {
    expect(formatTimecode(1)).toBe('00:00:01:00')
    expect(formatTimecode(1 + 12 / 24)).toBe('00:00:01:12')
    expect(formatTimecode(1 + 23 / 24)).toBe('00:00:01:23')
  })

  it('passe aux minutes et aux heures', () => {
    expect(formatTimecode(60)).toBe('00:01:00:00')
    expect(formatTimecode(120)).toBe('00:02:00:00')
    expect(formatTimecode(3661)).toBe('01:01:01:00')
  })
})

describe('borner', () => {
  it('borne dans [0, 1] par défaut', () => {
    expect(borner(-2)).toBe(0)
    expect(borner(0.4)).toBe(0.4)
    expect(borner(9)).toBe(1)
  })

  it('accepte des bornes personnalisées', () => {
    expect(borner(-5, -1, 1)).toBe(-1)
    expect(borner(5, -1, 1)).toBe(1)
  })
})
