import QRCode from 'qrcode'

import { lienCommande, lienSuivi } from '@/lib/liens'

/**
 * QR code (PNG) du lien de suivi d'un rendez-vous (code MC-...) ou de la page d'une réservation de
 * produits (code PR-...). Fond blanc et marge d'au moins 2 modules :
 * c'est ce qui rend le code lisible par tous les lecteurs, y compris sur un fond sombre.
 */
export function qrSuiviPng(codeSuivi: string, largeur = 480): Promise<Buffer> {
  return QRCode.toBuffer(codeSuivi.startsWith('PR-') ? lienCommande(codeSuivi) : lienSuivi(codeSuivi), {
    type: 'png',
    width: largeur,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0a0a0a', light: '#ffffff' },
  })
}
