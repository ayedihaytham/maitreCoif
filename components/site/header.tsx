import { SiteNav } from '@/components/site/site-nav'

// Volontairement sans lecture de session côté serveur : lire les cookies rendrait chaque page
// publique dynamique (aucun cache). La barre de navigation demande la session au navigateur.
export function Header() {
  return <SiteNav />
}
