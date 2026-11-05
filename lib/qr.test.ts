import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'

import { CODE_SUIVI_VALIDE, lienSuivi } from '@/lib/liens'
import { qrSuiviPng } from '@/lib/qr'

/** Lit le QR code d'une image PNG comme le ferait un téléphone. */
function lire(png: Buffer): string | null {
  const img = PNG.sync.read(png)
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data ?? null
}

describe('QR code du suivi', () => {
  it('se lit et mène au lien de suivi avec le code déjà rempli', async () => {
    expect(lire(await qrSuiviPng('MC-ABC2345'))).toBe(lienSuivi('MC-ABC2345'))
  })

  it('reste lisible en petit format (emails)', async () => {
    expect(lire(await qrSuiviPng('MC-XYZ7K9P', 200))).toBe(lienSuivi('MC-XYZ7K9P'))
  })

  it('est un PNG', async () => {
    const png = await qrSuiviPng('MC-ABC2345')
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })
})

describe('code de suivi accepté par /api/qr', () => {
  it('accepte les codes générés par le site et refuse le reste', () => {
    for (const ok of ['MC-ABC2345', 'MC-0000000', 'MC-XXXX']) expect(CODE_SUIVI_VALIDE.test(ok)).toBe(true)
    for (const mauvais of ['', 'ABC', 'MC-', 'MC-abc', 'MC-<script>', 'MC-AAAAAAAAAAAAAAA', 'http://evil.test']) expect(CODE_SUIVI_VALIDE.test(mauvais)).toBe(false)
  })
})
