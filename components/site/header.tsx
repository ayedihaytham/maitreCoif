import { SiteNav } from '@/components/site/site-nav'
import { getHorairesSalon } from '@/lib/horaires'
import { prisma } from '@/lib/prisma'

// Volontairement sans lecture de session côté serveur : lire les cookies rendrait chaque page
// publique dynamique (aucun cache). La barre de navigation demande la session au navigateur.
export async function Header() {
  const [horaires, produits] = await Promise.all([
    getHorairesSalon(),
    // La boutique n'apparaît que s'il y a au moins un produit en ligne ; en cas d'erreur on garde l'ancien comportement.
    prisma.produit.count({ where: { actif: true } }).catch(() => 1),
  ])
  return <SiteNav horaires={horaires} boutique={produits > 0} />
}
