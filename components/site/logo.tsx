import Image from 'next/image'
import Link from 'next/link'

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Maitre Coif, accueil">
      <Image src="/logo-gold.png" alt="" width={376} height={310} priority className="h-8 w-auto sm:h-9" />
      <span className="sr-only">Maitre Coif</span>
    </Link>
  )
}
