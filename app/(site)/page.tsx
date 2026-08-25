import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Scissors, Star } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { cn, formatPrix } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Accueil',
}

// Régénération périodique plutôt que rendu forcé à chaque requête : le
// contenu (services, équipe, avis) ne change pas seconde par seconde, et
// ça évite l'en-tête Cache-Control: no-store qui empêche le bfcache du
// navigateur (retour arrière instantané).
export const revalidate = 60

async function getAccueilData() {
  const [services, coiffeurs, avis, photosSalon] = await Promise.all([
    prisma.service.findMany({ where: { actif: true }, orderBy: { prix: 'asc' }, take: 3 }),
    prisma.user.findMany({
      where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
      orderBy: { dateCreation: 'asc' },
      take: 4,
    }),
    prisma.avis.findMany({
      where: { note: { gte: 4 } },
      orderBy: { dateCreation: 'desc' },
      take: 3,
      include: { rendezVous: { select: { clientNom: true } } },
    }),
    prisma.photoSalon.findMany({ orderBy: [{ ordre: 'asc' }, { dateCreation: 'asc' }], take: 4 }),
  ])

  return { services, coiffeurs, avis, photosSalon }
}

export default async function AccueilPage() {
  const { services, coiffeurs, avis, photosSalon } = await getAccueilData()

  const galerie =
    photosSalon.length > 0
      ? photosSalon.map((p) => ({ src: p.url, alt: p.legende ?? '' }))
      : [{ src: '/maitre-coif-interieur.jpg', alt: 'Décoration intérieure du salon Maitre Coif' }]

  return (
    <main>
      <section className="relative overflow-hidden border-b border-border/60">
        <Image
          src="/maitre-coif-facade.jpg"
          alt="Enseigne du salon Maitre Coif"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/50" />
        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-36 lg:px-12">
          <div className="eyebrow before:h-px before:w-8 before:bg-gold">Salon de coiffure & barbier</div>
          <h1 className="mt-8 max-w-3xl text-balance text-4xl font-light uppercase leading-[1.08] tracking-[0.12em] sm:text-6xl">
            L&apos;art de la coupe,
            <br />
            <span className="text-gold">révélé avec précision.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
            Chez Maitre Coif, chaque rendez-vous est pensé pour révéler votre style, dans un cadre élégant et
            attentif au détail.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button
              size="lg"
              className="uppercase tracking-[0.16em]"
              render={<Link href="/reservation" />}
              nativeButton={false}
            >
              Réserver un rendez-vous <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="uppercase tracking-[0.16em]"
              render={<Link href="/equipe" />}
              nativeButton={false}
            >
              Découvrir l&apos;équipe
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-anthracite px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
            <div>
              <p className="eyebrow before:h-px before:w-8 before:bg-gold">Nos prestations</p>
              <h2 className="mt-5 text-2xl font-light uppercase tracking-[0.16em] sm:text-3xl">Services phares</h2>
            </div>
            <Link
              href="/services"
              className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gold hover:text-foreground sm:flex"
            >
              Tous nos services <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {services.map((service) => (
              <article key={service.id} className="border border-border/70 bg-background p-6">
                <Scissors className="size-5 text-gold" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-light tracking-[0.06em]">{service.nom}</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{service.description}</p>
                <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{service.duree} min</span>
                  <span className="text-gold">{formatPrix(Number(service.prix))}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          {galerie.length === 1 ? (
            <div className="relative aspect-[4/3] overflow-hidden border border-border/70">
              <Image src={galerie[0].src} alt={galerie[0].alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {galerie.map((photo, i) => (
                <div
                  key={i}
                  className={cn('relative overflow-hidden border border-border/70', i === 0 && galerie.length === 3 && 'col-span-2 aspect-[16/9]', 'aspect-square')}
                >
                  <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="eyebrow before:h-px before:w-8 before:bg-gold">L&apos;univers du salon</p>
            <h2 className="mt-5 text-2xl font-light uppercase leading-tight tracking-[0.1em] sm:text-3xl">
              Un cadre pensé dans les moindres détails
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
              Chez Maitre Coif, l&apos;expérience commence dès l&apos;entrée : une décoration soignée, une
              ambiance chaleureuse et une équipe attentive à chaque détail, pour un moment qui vous ressemble.
            </p>
          </div>
        </div>
      </section>

      {coiffeurs.length > 0 && (
        <section className="px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
              <div>
                <p className="eyebrow before:h-px before:w-8 before:bg-gold">L&apos;équipe</p>
                <h2 className="mt-5 text-2xl font-light uppercase tracking-[0.16em] sm:text-3xl">
                  Rencontrez nos coiffeurs
                </h2>
              </div>
              <Link
                href="/equipe"
                className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gold hover:text-foreground sm:flex"
              >
                Toute l&apos;équipe <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {coiffeurs.map((c) => (
                <Link
                  key={c.id}
                  href={`/reservation?coiffeurId=${c.id}`}
                  className="group border border-border/70 bg-anthracite p-5 transition-all hover:-translate-y-1 hover:border-gold/80"
                >
                  <div className="relative size-16 overflow-hidden rounded-full border border-gold/40">
                    <Image
                      src={c.photo || '/maitre-coif-team.png'}
                      alt={`Portrait de ${c.prenom} ${c.nom}`}
                      fill
                      sizes="64px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="mt-4 text-sm font-light tracking-[0.06em]">
                    {c.prenom} {c.nom}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">{c.specialites[0] ?? 'Coiffeur'}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {avis.length > 0 && (
        <section className="bg-anthracite px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <p className="eyebrow before:h-px before:w-8 before:bg-gold">Ils nous font confiance</p>
            <h2 className="mt-5 text-2xl font-light uppercase tracking-[0.16em] sm:text-3xl">Avis clients</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {avis.map((a) => (
                <article key={a.id} className="border border-border/70 bg-background p-6">
                  <div className="flex gap-1 text-gold">
                    {Array.from({ length: a.note }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-gold" aria-hidden="true" />
                    ))}
                  </div>
                  {a.commentaire && <p className="mt-4 text-sm leading-6 text-muted-foreground">&quot;{a.commentaire}&quot;</p>}
                  <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-gold">{a.rendezVous.clientNom}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 border-t border-gold/30 pt-10 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="max-w-xl text-2xl font-light uppercase tracking-[0.1em] sm:text-3xl">
            Prêt à révéler votre style ?
          </h2>
          <Button
            size="lg"
            className="uppercase tracking-[0.16em]"
            render={<Link href="/reservation" />}
            nativeButton={false}
          >
            Réserver maintenant <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </main>
  )
}
