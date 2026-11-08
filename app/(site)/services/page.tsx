import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock } from 'lucide-react'

import { Cinema } from '@/components/site/cinema'
import { PacksListe } from '@/components/site/packs-liste'
import { PageHero } from '@/components/site/page-hero'
import { Reveal } from '@/components/site/reveal'
import { ServicesOnglets } from '@/components/site/services-onglets'
import { chargerPacksPrestations } from '@/lib/boutique'
import { prisma } from '@/lib/prisma'
import { formatPrix } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Nos services',
  description: 'Découvrez les prestations proposées par Maitre Coif : coupe, barbe, coloration, soins.',
}

// Les places restantes d'un pack changent avec les réservations : régénération assez fréquente.
export const revalidate = 30

export default async function ServicesPage() {
  const [services, packs] = await Promise.all([
    prisma.service.findMany({ where: { actif: true }, orderBy: [{ categorie: 'asc' }, { prix: 'asc' }] }),
    // Les packs ne doivent jamais empêcher la liste des services de s'afficher.
    chargerPacksPrestations().catch(() => []),
  ])

  const categories = Array.from(new Set(services.map((s) => s.categorie || 'Autres')))
  let numero = 0

  return (
    <main>
      <Cinema hud={false} />
      <PageHero
        etiquette="Nos prestations"
        image="/maitre-coif-interieur.jpg"
        lignes={[{ t: 'Nos' }, { t: 'services.', or: true }]}
        texte="Des prestations pensées pour chaque style, à l'unité ou réunies en packs, réalisées avec des produits professionnels et un savoir-faire exigeant. Tarifs en dinars tunisiens (DT), à régler au salon."
      />
      <div className="wrap s-page sec">
        <ServicesOnglets
          nbServices={services.length}
          nbPacks={packs.length}
          services={
            <>
        {services.length === 0 ? (
          <p className="empty-state" style={{ marginTop: 56 }}>
            Aucun service disponible pour le moment.
          </p>
        ) : (
          <div className="s-list">
            {categories.map((categorie) => (
              <div key={categorie}>
                <Reveal className="s-cat">
                  <div className="lbl">{categorie}</div>
                </Reveal>
                {services
                  .filter((s) => (s.categorie || 'Autres') === categorie)
                  .map((s) => {
                    numero += 1
                    return (
                      <Reveal as="article" key={s.id} className="s-row">
                        <div className="no" aria-hidden="true">
                          {String(numero).padStart(2, '0')}
                        </div>
                        <div>
                          <h2 style={{ margin: 0, font: '400 34px/1.1 var(--mc-serif)' }}>{s.nom}</h2>
                          {s.description && <p>{s.description}</p>}
                        </div>
                        <div className="d">
                          <Clock className="size-3.5" aria-hidden="true" />
                          {s.duree} min
                        </div>
                        <div className="p">{formatPrix(Number(s.prix))}</div>
                        <Link className="btn btn-ghost btn-sm" href={`/reservation?serviceId=${s.id}`} data-ph="reserver-prestation">
                          Réserver
                        </Link>
                      </Reveal>
                    )
                  })}
              </div>
            ))}
          </div>
        )}
            </>
          }
          packs={<PacksListe packs={packs} />}
        />
      </div>
    </main>
  )
}
