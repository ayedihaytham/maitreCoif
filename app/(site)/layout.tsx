import '../cinema.css'
import '../cinema-home.css'
import '../cinema-chrome.css'
import '../cinema-boutique.css'
import '../cinema-localisation.css'
import '../cinema-packs.css'
import '../cinema-fixes.css'

import { PanierProvider } from '@/components/boutique/panier'
import { PostHogProvider } from '@/components/analytics/posthog-provider'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { SiteEffects } from '@/components/site/site-effects'

// `.mc` délimite le site public : toute la feuille cinema.css est limitée à ce
// conteneur, le back-office n'est donc pas affecté.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mc flex min-h-screen flex-col bg-background text-foreground">
      {/* Sans JavaScript, tout reste visible et la pellicule défile normalement. */}
      <noscript>
        <style>{'.mc .rv{opacity:1!important;transform:none!important;filter:none!important}.mc .h-reel{height:auto}.mc .h-stage{position:static;height:auto;padding:90px 0}.mc .h-strip{transform:none;width:auto;overflow-x:auto}.mc .h-card{filter:none;transform:none}.mc .h-quote .w{opacity:1;transform:none;filter:none}.mc .h-hud,.mc .h-grain{display:none}'}</style>
      </noscript>
      <PanierProvider>
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
        <SiteEffects />
        <PostHogProvider />
      </PanierProvider>
    </div>
  )
}
