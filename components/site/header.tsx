import { SiteNav } from '@/components/site/site-nav'
import { getHorairesSalon } from '@/lib/horaires'

// Volontairement sans lecture de session côté serveur : lire les cookies rendrait chaque page
// publique dynamique (aucun cache). La barre de navigation demande la session au navigateur.
export async function Header() {
  const horaires = await getHorairesSalon()
  return <SiteNav horaires={horaires} />
}
