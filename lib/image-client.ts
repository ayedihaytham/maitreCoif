'use client'

// Redimensionne et compresse une image côté navigateur (canvas) avant envoi
// au serveur, où elle est stockée en base sous forme de data URI. Évite
// d'avoir besoin d'un service de stockage fichier externe (compatible
// déploiement serverless) tout en gardant des lignes raisonnables en base.

export const MAX_UPLOAD_SOURCE_BYTES = 15 * 1024 * 1024 // 15 Mo, garde-fou avant traitement

export async function resizeImageToDataUrl(file: File, maxDimension = 800, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier doit être une image.')
  }
  if (file.size > MAX_UPLOAD_SOURCE_BYTES) {
    throw new Error('Image trop volumineuse (15 Mo maximum).')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Impossible de traiter l'image sur cet appareil.")
  ctx.drawImage(bitmap, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', quality)
}
