import { prisma } from '@/lib/prisma'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans caractères ambigus (0/O, 1/I)

function randomCode(length = 7): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `MC-${code}`
}

export async function genererCodeSuiviUnique(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode()
    const existing = await prisma.rendezVous.findUnique({ where: { codeSuivi: code } })
    if (!existing) return code
  }
  throw new Error('Impossible de générer un code de suivi unique')
}
