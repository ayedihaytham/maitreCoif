import '../cinema.css'

import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { SiteEffects } from '@/components/site/site-effects'

// `.mc` délimite le site public : toute la feuille cinema.css est limitée à ce
// conteneur, le back-office n'est donc pas affecté.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mc flex min-h-screen flex-col bg-background text-foreground">
      {/* Sans JavaScript, les éléments à apparition progressive restent visibles. */}
      <noscript>
        <style>{'.mc .rv{opacity:1!important;transform:none!important}'}</style>
      </noscript>
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
      <SiteEffects />
    </div>
  )
}
