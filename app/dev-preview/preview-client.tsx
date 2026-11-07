'use client'

import '../cinema-admin.css'
import '../cinema-admin-boutique.css'
import '../cinema-fixes.css'

import { useSearchParams } from 'next/navigation'

import { AdminSidebar } from '@/components/admin/sidebar'
import { PlanningBoard } from '@/components/admin/planning-board'
import { AnalytiqueNonConfigure, AnalytiqueView } from '@/components/admin/analytique-view'
import { remplirSerie } from '@/lib/analytique'
import { CommandesManager } from '@/components/admin/commandes-manager'
import { EquipeManager } from '@/components/admin/equipe-manager'
import { FermeturesManager } from '@/components/admin/fermetures-manager'
import { GalerieManager } from '@/components/admin/galerie-manager'
import { PacksManager } from '@/components/admin/packs-manager'
import { ProduitsManager } from '@/components/admin/produits-manager'
import { RdvDialog } from '@/components/admin/rdv-dialog'
import { ServicesManager } from '@/components/admin/services-manager'
import { StatistiquesView, type StatsAffichees } from '@/components/admin/statistiques-view'

const coiffeurs = [
  { id: 'a', nom: 'kallel', prenom: 'ahmed' },
  { id: 'b', nom: 'h', prenom: 'houcem' },
]

const stats: StatsAffichees = {
  chiffreAffairesTotal: 420,
  nombreRendezVous: 18,
  tauxRemplissageGlobal: 0.42,
  parStatut: { CONFIRME: 8, EN_ATTENTE: 3, TERMINE: 5, ANNULE: 2 },
  parCoiffeur: [
    { id: 'a', nom: 'ahmed kallel', rendezVous: 10, chiffreAffaires: 260, tauxRemplissage: 0.5 },
    { id: 'b', nom: 'houcem h', rendezVous: 8, chiffreAffaires: 160, tauxRemplissage: 0.3 },
  ],
} as StatsAffichees

const serieFictive = remplirSerie(
  Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 6) - (29 - i) * 86_400_000).toISOString().slice(0, 10)
    const v = 12 + ((i * 7) % 23) + (i > 20 ? 14 : 0)
    return { jour: d, visiteurs: v, pagesVues: v * 3 }
  }),
  30,
  '2026-11-06',
)
const analytique = {
  jours: 30 as const,
  visiteurs: 842,
  pagesVues: 2615,
  reservations: 57,
  conversion: 57 / 842,
  serie: serieFictive,
  pages: [
    { page: '/', vues: 1120, visiteurs: 790 },
    { page: '/reservation', vues: 640, visiteurs: 312 },
    { page: '/services', vues: 390, visiteurs: 288 },
    { page: '/equipe', vues: 260, visiteurs: 201 },
    { page: '/galerie', vues: 140, visiteurs: 98 },
    { page: '/suivi', vues: 65, visiteurs: 41 },
  ],
  entonnoir: [
    { etape: 'Ont ouvert la réservation', personnes: 312 },
    { etape: 'Ont choisi un coiffeur', personnes: 201 },
    { etape: 'Ont choisi leurs prestations', personnes: 150 },
    { etape: 'Ont choisi un créneau', personnes: 96 },
    { etape: 'Réservation confirmée', personnes: 57 },
  ],
  clics: [
    { cible: 'reserver-barre', clics: 410 },
    { cible: 'reserver-accueil', clics: 295 },
    { cible: 'reserver-prestation', clics: 120 },
    { cible: 'toute-la-galerie', clics: 44 },
    { cible: 'theme', clics: 31 },
  ],
  sources: [
    { source: '$direct', visiteurs: 400 },
    { source: 'google.com', visiteurs: 250 },
    { source: 'instagram.com', visiteurs: 140 },
    { source: 'l.facebook.com', visiteurs: 52 },
  ],
  appareils: [
    { appareil: 'Téléphone', visiteurs: 590 },
    { appareil: 'Ordinateur', visiteurs: 230 },
    { appareil: 'Tablette', visiteurs: 22 },
  ],
  pays: [
    { pays: 'Tunisia', visiteurs: 780 },
    { pays: 'France', visiteurs: 41 },
    { pays: 'Libya', visiteurs: 9 },
  ],
}

export function PreviewClient() {
  const v = useSearchParams().get('v') ?? 'plan'
  return (
    <div className="ad">
      <AdminSidebar
        role="ADMIN"
        nom="ahmed kallel"
        aujourdhui={7}
        prochain={{ heure: '16:30', client: 'Sami B.', prestations: 'Coupe + Barbe', coiffeur: 'houcem', jour: "aujourd'hui" }}
        onSignOut={() => {}}
      />
      <main style={{ flex: 1, minWidth: 0 }} className={['svc', 'eq', 'fer', 'gal', 'ana', 'ana0', 'prod', 'pack', 'cmd'].includes(v) ? 'ad-body' : undefined}>
        {v === 'plan' && <PlanningBoard role="ADMIN" currentUserId="a" coiffeurs={coiffeurs} />}
        {v === 'stats' && <StatistiquesView periode="mois" stats={stats} />}
        {v === 'svc' && (
          <ServicesManager
            initial={[
              { id: '1', nom: 'Coupe classique', description: 'Aux ciseaux', prix: 28, duree: 30, categorie: 'Coupe', actif: true },
              { id: '2', nom: 'Barbe', description: null, prix: 18, duree: 20, categorie: 'Barbe', actif: false },
            ]}
          />
        )}
        {v === 'eq' && (
          <EquipeManager
            initial={[
              { id: 'a', nom: 'kallel', prenom: 'ahmed', email: 'ahmed.kallel.exemple@gmail.com', telephone: '20130289', role: 'ADMIN', photo: null, specialites: ['Coupe & barbe', 'Coloration'], bio: 'Fondateur du salon.', actif: true },
              { id: 'b', nom: 'houcem', prenom: 'houcem', email: 'houcem@exemple.com', telephone: null, role: 'COIFFEUR', photo: null, specialites: [], bio: null, actif: true },
              { id: 'c', nom: 'baklouti', prenom: 'wassim', email: 'wassim.baklouti.tres.long.exemple@gmail.com', telephone: null, role: 'COIFFEUR', photo: null, specialites: ['Dégradé'], bio: null, actif: false },
            ]}
          />
        )}
        {v === 'fer' && (
          <FermeturesManager
            coiffeurs={coiffeurs}
            initial={[
              { id: '1', coiffeurId: null, coiffeur: null, dateDebut: '2026-12-24', dateFin: '2026-12-26', motif: 'Fêtes de fin d’année' },
              { id: '2', coiffeurId: 'a', coiffeur: { prenom: 'ahmed', nom: 'kallel' }, dateDebut: '2027-01-10', dateFin: '2027-01-10', motif: null },
            ]}
          />
        )}
        {v === 'gal' && (
          <GalerieManager
            initial={[
              { id: '1', url: '/maitre-coif-facade.jpg', legende: 'L’enseigne lumineuse' },
              { id: '2', url: '/maitre-coif-interieur.jpg', legende: null },
              { id: '3', url: '/maitre-coif-team.png', legende: 'L’équipe au complet' },
            ]}
          />
        )}
        {v === 'ana' && <AnalytiqueView donnees={analytique} periode={30} erreurs={['entonnoir : PostHog a répondu 500 (exemple d’erreur affichée)']} />}
        {v === 'ana0' && <AnalytiqueNonConfigure />}
        {v === 'prod' && (
          <ProduitsManager
            initial={[
              { id: '1', nom: 'Huile à barbe', description: 'Nourrit et adoucit, parfum bois de cèdre.', prix: 24, categorie: 'Barbe', stock: 12, actif: true, image: null },
              { id: '2', nom: 'Baume à barbe', description: null, prix: 18, categorie: 'Barbe', stock: 3, actif: true, image: null },
              { id: '3', nom: 'Pommade brillante', description: 'Brillance classique.', prix: 20, categorie: 'Coiffage', stock: 0, actif: true, image: null },
              { id: '4', nom: 'Peigne en bois', description: null, prix: 12, categorie: 'Accessoires', stock: 25, actif: false, image: null },
            ]}
          />
        )}
        {v === 'pack' && (
          <PacksManager
            initial={[
              {
                id: '1',
                nom: 'Pack Barbier',
                description: 'La taille au salon, l’huile et le baume pour la maison.',
                remiseType: 'POURCENTAGE',
                remiseValeur: 15,
                debut: null,
                fin: null,
                actif: true,
                lignes: [
                  { type: 'service', id: 's1', nom: 'Taille de barbe', quantite: 1, prix: 18 },
                  { type: 'produit', id: '1', nom: 'Huile à barbe', quantite: 1, prix: 24 },
                  { type: 'produit', id: '2', nom: 'Baume à barbe', quantite: 1, prix: 18 },
                ],
                prix: { normal: 60, final: 51, economie: 9, pourcentage: 15 },
                raison: null,
              },
              {
                id: '2',
                nom: 'Pack Gentleman',
                description: null,
                remiseType: 'PRIX_FIXE',
                remiseValeur: 30,
                debut: null,
                fin: '2026-12-31',
                actif: true,
                lignes: [{ type: 'produit', id: '3', nom: 'Pommade brillante', quantite: 1, prix: 20 }, { type: 'produit', id: '4', nom: 'Peigne en bois', quantite: 1, prix: 12 }],
                prix: { normal: 32, final: 30, economie: 2, pourcentage: 6 },
                raison: 'rupture',
              },
            ]}
            produits={[
              { id: '1', nom: 'Huile à barbe', prix: 24, stock: 12, actif: true },
              { id: '2', nom: 'Baume à barbe', prix: 18, stock: 3, actif: true },
            ]}
            services={[{ id: 's1', nom: 'Taille de barbe', prix: 18, duree: 20, actif: true }]}
          />
        )}
        {v === 'cmd' && (
          <CommandesManager
            initial={[
              { id: '1', code: 'PR-7K2M9QX', statut: 'A_PREPARER', clientNom: 'Sami Ben Ali', clientTelephone: '20 130 289', clientEmail: 'sami@exemple.com', retrait: 'SALON', jourSouhaite: 'samedi 8 novembre', notes: null, total: 60, economie: 0, expireLe: '2026-11-14T10:00:00.000Z', dateCreation: '2026-11-07T10:00:00.000Z', lignes: [{ nom: 'Huile à barbe', quantite: 1, type: 'PRODUIT', contenu: [] }, { nom: 'Baume à barbe', quantite: 2, type: 'PRODUIT', contenu: [] }], rendezVous: null },
              { id: '2', code: 'PR-9XQ2LHV', statut: 'PRETE', clientNom: 'Walid Trabelsi', clientTelephone: '98 441 207', clientEmail: 'walid.trabelsi.adresse.longue@exemple.com', retrait: 'RDV', jourSouhaite: null, notes: null, total: 51, economie: 9, expireLe: '2026-11-14T10:00:00.000Z', dateCreation: '2026-11-06T10:00:00.000Z', lignes: [{ nom: 'Pack Barbier', quantite: 1, type: 'PACK', contenu: [{ type: 'service', nom: 'Taille de barbe', quantite: 1, prix: 18 }, { type: 'produit', nom: 'Huile à barbe', quantite: 1, prix: 24 }, { type: 'produit', nom: 'Baume à barbe', quantite: 1, prix: 18 }] }], rendezVous: { date: '2026-11-14', heureDebut: '10:00', coiffeur: 'houcem h', statut: 'CONFIRME' } },
              { id: '3', code: 'PR-5HZV1TS', statut: 'RETIREE', clientNom: 'Yassine Mejri', clientTelephone: '50 118 733', clientEmail: 'y@exemple.com', retrait: 'SALON', jourSouhaite: null, notes: null, total: 28, economie: 0, expireLe: '2026-11-04T10:00:00.000Z', dateCreation: '2026-11-03T10:00:00.000Z', lignes: [{ nom: 'Spray texturisant', quantite: 1, type: 'PRODUIT', contenu: [] }], rendezVous: null },
            ]}
          />
        )}
        {v === 'dlg' && (
          <RdvDialog open onOpenChange={() => {}} coiffeurs={coiffeurs} defaultCoiffeurId="a" defaultDate="2026-11-06" coiffeurFige={false} onDone={() => {}} />
        )}
      </main>
    </div>
  )
}
