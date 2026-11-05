'use client'

import '../cinema-admin.css'
import '../cinema-fixes.css'

import { useSearchParams } from 'next/navigation'

import { AdminSidebar } from '@/components/admin/sidebar'
import { PlanningBoard } from '@/components/admin/planning-board'
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
      <main style={{ flex: 1, minWidth: 0 }} className={v === 'svc' || v === 'eq' || v === 'fer' || v === 'gal' ? 'ad-body' : undefined}>
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
        {v === 'dlg' && (
          <RdvDialog open onOpenChange={() => {}} coiffeurs={coiffeurs} defaultCoiffeurId="a" defaultDate="2026-11-06" coiffeurFige={false} onDone={() => {}} />
        )}
      </main>
    </div>
  )
}
