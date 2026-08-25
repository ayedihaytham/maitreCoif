import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M15 8.5h2V5.2h-2.2C12.4 5.2 11 6.6 11 9v2H9v3.3h2V21h3.3v-6.7h2.4l.6-3.3h-3V9c0-.4.2-.5.7-.5Z" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-gold/30 bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto mb-10 flex max-w-7xl justify-center sm:justify-start">
        <Image src="/logo-gold.png" alt="Maitre Coif" width={376} height={310} className="h-16 w-auto opacity-90" />
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 pb-8 sm:grid-cols-3">
        <div>
          <p className="eyebrow before:h-px before:w-8 before:bg-gold">L&apos;adresse</p>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
            Route Afran Km 5
            <br />
            Sfax, Tunisie
          </p>
        </div>
        <div>
          <p className="eyebrow before:h-px before:w-8 before:bg-gold">Horaires</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Mardi — Samedi
            <br />
            10h00 — 20h30
            <br />
            Sur rendez-vous uniquement
          </p>
        </div>
        <div>
          <p className="eyebrow before:h-px before:w-8 before:bg-gold">Suivez-nous</p>
          <div className="mt-4 flex gap-3">
            <a
              href="https://www.instagram.com/maitrecoif/"
              target="_blank"
              rel="noreferrer"
              className="flex size-10 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold"
              aria-label="Instagram"
            >
              <InstagramIcon className="size-4" />
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=100064083337227"
              target="_blank"
              rel="noreferrer"
              className="flex size-10 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold"
              aria-label="Facebook"
            >
              <FacebookIcon className="size-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-border/60 pt-6 text-[9px] uppercase tracking-[0.18em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Maitre Coif</span>
        <Link href="/reservation" className="flex items-center gap-2 text-gold hover:text-foreground">
          Prendre rendez-vous <CalendarDays className="size-3" />
        </Link>
        <span>Sfax · Tunisie</span>
      </div>
    </footer>
  )
}
