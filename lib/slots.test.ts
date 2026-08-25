import { describe, expect, it } from 'vitest'

import { minutesToTime, timeToMinutes } from './slots'

describe('timeToMinutes', () => {
  it('convertit une heure en minutes depuis minuit', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('10:00')).toBe(600)
    expect(timeToMinutes('19:30')).toBe(1170)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

describe('minutesToTime', () => {
  it('convertit des minutes en heure HH:MM avec zéro de tête', () => {
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(600)).toBe('10:00')
    expect(minutesToTime(605)).toBe('10:05')
    expect(minutesToTime(1439)).toBe('23:59')
  })

  it('est l\'inverse exact de timeToMinutes', () => {
    for (const time of ['09:00', '13:45', '19:30', '23:59']) {
      expect(minutesToTime(timeToMinutes(time))).toBe(time)
    }
  })
})
