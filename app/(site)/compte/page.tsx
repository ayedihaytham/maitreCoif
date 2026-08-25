import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: 'bg-secondary text-secondary-foreground',
  CONFIRME: 'bg-primary text-primary-foreground',
  TERMINE: 'bg-transparent border border-border text-foreground',
  ANNULE: 'bg-destructive/10 text-destructive',
}

export default async function ComptePage() {
  const session = await auth()
  if (!session?.user) return null

  const [user, rendezVous] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.rendezVous.findMany({
      where: { clientUserId: session.user.id },
      orderBy: [{ date: 'desc' }, { heureDebut: 'desc' }],
      include: {
        coiffeur: { select: { nom: true, prenom: true } },
        service: { select: { nom: true } },
        avis: true,
      },
    }),
  ])

  if (!user) return null

  const now = new Date()
  const upcoming = rendezVous.filter((r) => r.date >= new Date(now.toDateString()) && r.statut !== 'ANNULE')
  const past = rendezVous.filter((r) => !upcoming.includes(r))

  return (
    <main className="px-5 pb-24 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <div className="eyebrow before:h-px before:w-8 before:bg-gold">Espace client</div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-light uppercase tracking-[0.1em] sm:text-4xl">
            Bonjour <span className="text-gold">{user.prenom}</span>
          </h1>
          <Button render={<Link href="/reservation" />} nativeButton={false}>
            Nouvelle réservation <ArrowRight className="size-4" />
          </Button>
        </div>

        <section className="mt-12">
          <h2 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Mes informations</h2>
          <ProfileForm initial={{ nom: user.nom, prenom: user.prenom, telephone: user.telephone }} />
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Adresse email</h2>
          <EmailForm initialEmail={user.email} />
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Mot de passe</h2>
          <PasswordForm />
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Rendez-vous à venir
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rendez-vous à venir.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((rdv) => (
                <RendezVousCard key={rdv.id} rdv={rdv} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Historique</h2>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rendez-vous passé.</p>
          ) : (
            <div className="space-y-3">
              {past.map((rdv) => (
                <RendezVousCard key={rdv.id} rdv={rdv} />
              ))}
            </div>
          )}
        </section>
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
    service: { nom: string }
    avis: { id: string } | null
  }
}) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-4 border border-border/70 bg-anthracite p-5">
      <div>
        <p className="text-sm">
          {rdv.service.nom} — {rdv.coiffeur.prenom} {rdv.coiffeur.nom}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {rdv.date.toISOString().slice(0, 10)} à {rdv.heureDebut} · {rdv.codeSuivi}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={STATUT_STYLE[rdv.statut]}>{STATUT_LABEL[rdv.statut]}</Badge>
        {rdv.statut === 'TERMINE' && !rdv.avis && <ReviewDialog rendezVousId={rdv.id} serviceNom={rdv.service.nom} />}
      </div>
    </article>
  )
}
