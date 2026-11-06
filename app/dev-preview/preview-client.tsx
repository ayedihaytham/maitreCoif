'use client'

import '../cinema-admin.css'
import '../cinema-fixes.css'

import { useSearchParams } from 'next/navigation'

import { AdminSidebar } from '@/components/admin/sidebar'
import { PlanningBoard } from '@/components/admin/planning-board'
import { AnalytiqueNonConfigure, AnalytiqueView } from '@/components/admin/analytique-view'
import { remplirSerie } from '@/lib/analytique'
import { EquipeManager } from '@/components/admin/equipe-manager'
import { FermeturesManager } from '@/components/admin/fermetures-manager'
import { GalerieManager } from '@/components/admin/galerie-manager'
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
      <main style={{ flex: 1, minWidth: 0 }} className={v === 'svc' || v === 'eq' || v === 'fer' || v === 'gal' || v === 'ana' || v === 'ana0' ? 'ad-body' : undefined}>
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
        {v === 'dlg' && (
          <RdvDialog open onOpenChange={() => {}} coiffeurs={coiffeurs} defaultCoiffeurId="a" defaultDate="2026-11-06" coiffeurFige={false} onDone={() => {}} />
        )}
      </main>
    </div>
  )
}
