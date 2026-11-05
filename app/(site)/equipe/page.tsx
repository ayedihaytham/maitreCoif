import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Star } from 'lucide-react'

import { Cinema } from '@/components/site/cinema'
import { PageHero } from '@/components/site/page-hero'
import { PortraitRond } from '@/components/site/portrait'
import { Reveal } from '@/components/site/reveal'
import { attribuerPortraits } from '@/lib/portraits'
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

  return attribuerPortraits(coiffeurs).map((c) => {
    const notes = c.rendezVousCoiffeur.map((r) => r.avis?.note).filter((n): n is number => typeof n === 'number')
    const moyenne = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null
    return {
      id: c.id,
      prenom: c.prenom,
      nom: `${c.prenom} ${c.nom}`,
      role: c.role === 'ADMIN' ? 'Gérant · Fondateur' : 'Coiffeur',
      specialites: c.specialites,
      bio: c.bio,
      note: moyenne ? moyenne.toFixed(1).replace('.', ',') : null,
      portrait: c.portrait,
    }
  })
}

export default async function EquipePage() {
  const equipe = await getEquipe()

  return (
    <main>
      <Cinema hud={false} />
      <PageHero
        etiquette="L'équipe"
        scene="SC. 03 · PRISE 1 · LE CASTING"
        image="/maitre-coif-team.png"
        lignes={[{ t: 'Des gestes précis.' }, { t: 'Des styles singuliers.', or: true }]}
        texte="Une équipe de passionnés, réunie autour d'une même exigence : révéler votre style avec justesse, dans un cadre où chaque détail compte. Choisissez votre coiffeur et trouvez le créneau qui vous ressemble."
      />
      <section className="h-cast page" data-track aria-label="Les coiffeurs">
        <div className="h-cast-word" aria-hidden="true">
          CASTING
        </div>
        <div className="wrap">
          {equipe.length === 0 ? (
            <p className="empty-state">L&apos;équipe sera bientôt annoncée.</p>
          ) : (
            <div className="h-cast-grid wide">
              {equipe.map((m, i) => (
                <Reveal as="article" key={m.id} className="h-cs" delay={i % 3}>
                  <div className="tag">
                    <b>Essai {String(i + 1).padStart(2, '0')}</b> · {m.role}
                  </div>
                  <PortraitRond portrait={m.portrait} nom={m.nom} />
                  <h2 style={{ position: 'relative', margin: '30px 0 0', font: '400 clamp(28px,3.2vw,40px)/1.05 var(--mc-serif)' }}>{m.nom}</h2>
                  {m.note && (
                    <div className="rating">
                      <Star className="size-3.5" fill="currentColor" aria-hidden="true" />
                      <span>{m.note} / 5</span>
                    </div>
                  )}
                  {m.specialites.length > 0 && (
                    <div className="chips">
                      {m.specialites.map((sp) => (
                        <span className="chip" key={sp}>
                          {sp}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.bio && <p>{m.bio}</p>}
                  <Link className="tlink" href={`/reservation?coiffeurId=${m.id}`}>
                    Voir ses disponibilités <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
