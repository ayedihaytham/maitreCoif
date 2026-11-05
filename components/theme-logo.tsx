import Image from 'next/image'

/**
 * Logo adapté au thème : version dorée sur fond sombre, version noire et or sur fond clair.
 * Les deux images sont dans la page ; le CSS (app/theme.css) n'en affiche qu'une.
 */
export function ThemeLogo({ alt = 'Maitre Coif', priority = false, className }: { alt?: string; priority?: boolean; className?: string }) {
  return (
    <>
      <Image src="/logo-gold.png" alt={alt} width={376} height={310} priority={priority} className={`lg-dark${className ? ` ${className}` : ''}`} />
      <Image src="/logo-black.png" alt="" aria-hidden="true" width={376} height={310} priority={priority} className={`lg-light${className ? ` ${className}` : ''}`} />
    </>
  )
}
