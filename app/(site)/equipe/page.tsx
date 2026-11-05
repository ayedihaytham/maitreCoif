import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Star } from 'lucide-react'

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
      <div className="wrap page-head sec">
        <div className="lbl">L&apos;équipe</div>
        <h1 className="page-h1">
          Des gestes précis. <em>Des styles singuliers.</em>
        </h1>
        <p className="lead">
          Une équipe de passionnés, réunie autour d&apos;une même exigence : révéler votre style avec justesse, dans un
          cadre où chaque détail compte. Choisissez votre coiffeur et trouvez le créneau qui vous ressemble.
        </p>

        {equipe.length === 0 ? (
          <p className="empty-state" style={{ marginTop: 56 }}>
            L&apos;équipe sera bientôt annoncée.
          </p>
        ) : (
          <div className="t-grid">
            {equipe.map((m, i) => (
              <Reveal as="article" key={m.id} className="cc" delay={i % 3}>
                <div className="spot" />
                <PortraitRond portrait={m.portrait} nom={m.nom} />
                <h2 style={{ position: 'relative', margin: '30px 0 0', font: '400 38px/1.05 var(--mc-serif)' }}>{m.nom}</h2>
                <div className="lbl" style={{ position: 'relative', marginTop: 12, fontSize: 10.5 }}>
                  {m.role}
                </div>
                {m.note && (
                  <div style={{ position: 'relative', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mc-gold)' }}>
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
    </main>
  )
}
