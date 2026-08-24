import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Scissors } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { formatPrix } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Nos services',
  description: 'Découvrez les prestations proposées par Maitre Coif : coupe, barbe, coloration, soins.',
}

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const services = await prisma.service.findMany({ where: { actif: true }, orderBy: [{ categorie: 'asc' }, { prix: 'asc' }] })

  const categories = Array.from(new Set(services.map((s) => s.categorie || 'Autres')))

  return (
    <main>
      <section className="border-b border-border/60 px-5 pb-16 pt-20 sm:px-8 sm:pb-20 sm:pt-28 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="eyebrow before:h-px before:w-8 before:bg-gold">Prestations</div>
          <h1 className="mt-8 max-w-2xl text-balance text-4xl font-light uppercase leading-[1.08] tracking-[0.12em] sm:text-6xl">
            Nos <span className="text-gold">services</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
            Des prestations pensées pour chaque style, réalisées avec des produits professionnels et un savoir-faire
            exigeant.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-7xl space-y-14">
          {categories.map((categorie) => (
            <div key={categorie}>
              <p className="eyebrow mb-6 before:h-px before:w-8 before:bg-gold">{categorie}</p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {services
                  .filter((s) => (s.categorie || 'Autres') === categorie)
                  .map((service) => (
                    <article key={service.id} className="border border-border/70 bg-anthracite p-6">
                      <Scissors className="size-5 text-gold" aria-hidden="true" />
                      <h3 className="mt-5 text-lg font-light tracking-[0.06em]">{service.nom}</h3>
                      {service.description && (
                        <p className="mt-2 text-xs leading-6 text-muted-foreground">{service.description}</p>
                      )}
                      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{service.duree} min</span>
                        <span className="text-gold">{formatPrix(Number(service.prix))}</span>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          ))}

          {services.length === 0 && <p className="text-sm text-muted-foreground">Aucun service disponible pour le moment.</p>}

          <div className="flex justify-center pt-6">
            <Link
              href="/reservation"
              className="flex items-center gap-2 border border-gold px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-gold transition-colors hover:bg-gold hover:text-background"
            >
              Réserver un rendez-vous <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
