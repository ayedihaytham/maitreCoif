import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inclurePrestations, prestationsDuRendezVous } from '@/lib/prestations'
import { salonUrl } from '@/lib/salon-host'
import { maintenantSalon } from '@/lib/slots'
import { cn } from '@/lib/utils'
import { ProfileForm } from '@/components/compte/profile-form'
import { EmailForm, PasswordForm } from '@/components/compte/security-forms'
import { ReviewDialog } from '@/components/compte/review-dialog'

export const metadata: Metadata = {
  title: 'Mon compte',
}

export const dynamic = 'force-dynamic'

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
}

const STATUT_CLASSE: Record<string, string> = {
  EN_ATTENTE: 'att',
  CONFIRME: '',
  TERMINE: 'ter',
  ANNULE: 'ann',
}

function dateLongue(d: Date) {
  const t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default async function ComptePage() {
  const session = await auth()
  // /compte est l'espace client (Auth.js) ; la protection est faite ici car le
  // proxy ne partage pas de session avec Auth.js.
  if (!session?.user) redirect('/connexion?redirect=/compte')
  // Le personnel n'a pas d'espace client : son compte se gère dans Clerk.
  if (session.user.role !== 'CLIENT') redirect(salonUrl('/planning'))

  const [user, rendezVous] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.rendezVous.findMany({
      where: { clientUserId: session.user.id },
      orderBy: [{ date: 'desc' }, { heureDebut: 'desc' }],
      include: {
        coiffeur: { select: { nom: true, prenom: true } },
        ...inclurePrestations,
        avis: true,
      },
    }),
  ])

  if (!user) return null

  // « À venir » = aujourd'hui (jour du salon) ou plus tard, hors annulés.
  const aujourdhui = maintenantSalon().dateISO
  const upcoming = rendezVous.filter((r) => r.date.toISOString().slice(0, 10) >= aujourdhui && r.statut !== 'ANNULE')
  const past = rendezVous.filter((r) => !upcoming.includes(r))

  return (
    <main>
      <div className="wrap page-head sec">
        <div className="lbl">Espace client</div>
        <div className="head-row" style={{ marginTop: 6 }}>
          <h1 className="page-h1" style={{ margin: '14px 0 0' }}>
            Bonjour <em>{user.prenom}.</em>
          </h1>
          <Link className="btn btn-gold" href="/reservation">
            Nouvelle réservation <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="compte-grid">
          <div>
            <section className="compte-sec" aria-labelledby="t-venir">
              <h2 className="sec-t" id="t-venir">
                <b>Rendez-vous à venir</b>
              </h2>
              {upcoming.length === 0 ? (
                <p className="empty-state">Aucun rendez-vous à venir.</p>
              ) : (
                upcoming.map((rdv) => <RendezVousCard key={rdv.id} rdv={rdv} />)
              )}
            </section>

            <section className="compte-sec" aria-labelledby="t-histo">
              <h2 className="sec-t" id="t-histo">
                <b>Historique</b>
              </h2>
              {past.length === 0 ? (
                <p className="empty-state">Aucun rendez-vous passé.</p>
              ) : (
                past.map((rdv) => <RendezVousCard key={rdv.id} rdv={rdv} />)
              )}
            </section>
          </div>

          <div>
            <section className="compte-sec" aria-labelledby="t-infos">
              <h2 className="sec-t" id="t-infos">
                <b>Mes informations</b>
              </h2>
              <ProfileForm initial={{ nom: user.nom, prenom: user.prenom, telephone: user.telephone }} />
            </section>

            <section className="compte-sec" aria-labelledby="t-email">
              <h2 className="sec-t" id="t-email">
                <b>Adresse email</b>
              </h2>
              <EmailForm initialEmail={user.email} />
            </section>

            <section className="compte-sec" aria-labelledby="t-mdp">
              <h2 className="sec-t" id="t-mdp">
                <b>Mot de passe</b>
              </h2>
              <PasswordForm />
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

function RendezVousCard({
  rdv,
}: {
  rdv: {
    id: string
    codeSuivi: string
    statut: string
    date: Date
    heureDebut: string
    coiffeur: { nom: string; prenom: string }
    service: { nom: string; prix: unknown; duree: number }
    lignes: { nom: string; prix: unknown; duree: number; ordre: number }[]
    avis: { id: string } | null
  }
}) {
  return (
    <article className="rdv">
      <div>
        <div className="t">
          {prestationsDuRendezVous(rdv).nom} — {rdv.coiffeur.prenom} {rdv.coiffeur.nom}
        </div>
        <div className="m">
          {dateLongue(rdv.date)} à {rdv.heureDebut} · {rdv.codeSuivi}
        </div>
      </div>
      <div className="rdv-actions">
        <span className={cn('badge', STATUT_CLASSE[rdv.statut])}>{STATUT_LABEL[rdv.statut]}</span>
        {rdv.statut === 'TERMINE' && !rdv.avis && <ReviewDialog rendezVousId={rdv.id} serviceNom={prestationsDuRendezVous(rdv).nom} />}
      </div>
    </article>
  )
}
