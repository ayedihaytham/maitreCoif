import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Star } from 'lucide-react'

import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Notre équipe',
  description: "Découvrez l'équipe de coiffeurs et barbiers de Maitre Coif.",
}

export const revalidate = 60

async function getEquipe() {
  const coiffeurs = await prisma.user.findMany({
    where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
    orderBy: { dateCreation: 'asc' },
    include: {
      rendezVousCoiffeur: {
        where: { avis: { isNot: null } },
        select: { avis: { select: { note: true } } },
      },
    },
  })

  return coiffeurs.map((c) => {
    const notes = c.rendezVousCoiffeur.map((r) => r.avis?.note).filter((n): n is number => typeof n === 'number')
    const moyenne = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null
    return {
      id: c.id,
      nom: `${c.prenom} ${c.nom}`,
      role: c.specialites.join(', ') || (c.role === 'ADMIN' ? 'Fondateur' : 'Coiffeur'),
      rating: moyenne ? moyenne.toFixed(1) : '—',
      photo: c.photo || '/maitre-coif-team.png',
      isFondateur: c.role === 'ADMIN',
    }
  })
}

export default async function EquipePage() {
  const equipe = await getEquipe()

  return (
    <main>
      <section className="border-b border-border/60 px-5 pb-16 pt-20 sm:px-8 sm:pb-20 sm:pt-28 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="eyebrow before:h-px before:w-8 before:bg-gold">L&apos;équipe</div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
            <h1 className="max-w-3xl text-balance text-4xl font-light uppercase leading-[1.08] tracking-[0.12em] sm:text-6xl">
              Des gestes précis.
              <br />
              <span className="text-gold">Des styles singuliers.</span>
            </h1>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground lg:justify-self-end">
              Une équipe de passionnés, réunie autour d&apos;une même exigence : révéler votre style avec justesse,
              dans un cadre où chaque détail compte.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-anthracite px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
            <div>
              <p className="eyebrow before:h-px before:w-8 before:bg-gold">Les experts</p>
              <h2 className="mt-5 text-2xl font-light uppercase tracking-[0.16em] sm:text-3xl">Notre équipe</h2>
            </div>
            <p className="hidden max-w-xs text-right text-xs leading-6 text-muted-foreground sm:block">
              Choisissez votre coiffeur et trouvez le créneau qui vous ressemble.
            </p>
          </div>

          {equipe.length === 0 ? (
            <p className="text-sm text-muted-foreground">L&apos;équipe sera bientôt annoncée.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {equipe.map((member) => (
                <article
                  key={member.id}
                  className="group border border-border/70 bg-background p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gold/80 hover:shadow-[0_12px_30px_rgba(0,0,0,0.25)] sm:p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="relative size-24 overflow-hidden rounded-full border border-gold/40 sm:size-28">
                      <Image
                        src={member.photo}
                        alt={`Portrait de ${member.nom}`}
                        fill
                        sizes="(min-width: 640px) 112px, 96px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    {member.isFondateur && (
                      <span className="border border-gold/70 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-gold">
                        Fondateur
                      </span>
                    )}
                  </div>
                  <div className="mt-7 flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-light tracking-[0.08em]">{member.nom}</h3>
                      <p className="mt-2 text-xs text-muted-foreground">{member.role}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gold">
                      <Star className="size-3 fill-gold" aria-hidden="true" />
                      {member.rating}
                    </div>
                  </div>
                  <div className="my-6 h-px bg-border/60" />
                  <Link
                    href={`/reservation?coiffeurId=${member.id}`}
                    className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-gold transition-colors hover:text-foreground"
                  >
                    Voir ses disponibilités <ArrowRight className="size-4" />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
