import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronDown, Clock } from 'lucide-react'

import { HomeEffects } from '@/components/site/home-effects'
import { Intro } from '@/components/site/intro'
import { PortraitRond } from '@/components/site/portrait'
import { Reveal } from '@/components/site/reveal'
import { ReviewCarousel, type AvisAffiche } from '@/components/site/review-carousel'
import { attribuerPortraits } from '@/lib/portraits'
import { libelleJour, prochaineDisponibilite } from '@/lib/prochaine-disponibilite'
import { prisma } from '@/lib/prisma'
import { formatPrix } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Accueil',
}

// Régénération périodique plutôt que rendu forcé à chaque requête : le
// contenu (services, équipe, avis) ne change pas seconde par seconde, et
// ça évite l'en-tête Cache-Control: no-store qui empêche le bfcache du
// navigateur (retour arrière instantané).
export const revalidate = 60

async function getAccueilData() {
  const [tousLesServices, coiffeurs, avis, statsAvis, photosSalon, prochaine] = await Promise.all([
    prisma.service.findMany({ where: { actif: true }, orderBy: { prix: 'asc' } }),
    prisma.user.findMany({
      where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
      orderBy: { dateCreation: 'asc' },
      take: 3,
    }),
    prisma.avis.findMany({
      where: { note: { gte: 4 }, commentaire: { not: null } },
      orderBy: { dateCreation: 'desc' },
      take: 5,
      include: {
        rendezVous: {
          select: {
            clientNom: true,
            service: { select: { nom: true } },
            coiffeur: { select: { prenom: true, nom: true } },
          },
        },
      },
    }),
    prisma.avis.aggregate({ _avg: { note: true }, _count: { _all: true } }),
    prisma.photoSalon.findMany({ orderBy: [{ ordre: 'asc' }, { dateCreation: 'asc' }], take: 2 }),
    prochaineDisponibilite().catch(() => null),
  ])

  return { tousLesServices, coiffeurs, avis, statsAvis, photosSalon, prochaine }
}

export default async function AccueilPage() {
  const { tousLesServices, coiffeurs, avis, statsAvis, photosSalon, prochaine } = await getAccueilData()

  const services = tousLesServices.slice(0, 5)
  const equipe = attribuerPortraits(coiffeurs)
  const avisAffiches: AvisAffiche[] = avis.map((a) => ({
    id: a.id,
    note: a.note,
    texte: a.commentaire ?? '',
    client: a.rendezVous.clientNom,
    meta: `${a.rendezVous.service.nom} · avec ${a.rendezVous.coiffeur.prenom} ${a.rendezVous.coiffeur.nom}`,
  }))
  const moyenne = statsAvis._avg.note
  const nbAvis = statsAvis._count._all

  // Bandeau défilant : les noms des prestations, répétés pour toujours remplir la largeur.
  const noms = tousLesServices.map((s) => s.nom)
  const bandeau = noms.length > 0 ? Array.from({ length: Math.max(1, Math.ceil(8 / noms.length)) }).flatMap(() => noms) : []

  const photoPrincipale = photosSalon[0]
  const photoSecondaire = photosSalon[1]

  return (
    <main>
      <Intro />
      <HomeEffects />

      {/* ───────────── Scène 01 · Ouverture ───────────── */}
      <section className="hero" data-scene="0" aria-label="Ouverture">
        <div className="hero-media" id="heroMedia">
          <Image
            src="/maitre-coif-facade.jpg"
            alt="Enseigne lumineuse Maitre Coif, en lettres rétro-éclairées"
            fill
            preload
            quality={70}
            sizes="100vw"
          />
        </div>
        <div className="glow" />
        <svg className="grain" aria-hidden="true">
          <filter id="grain-accueil">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-accueil)" />
        </svg>
        <span className="vf tl" />
        <span className="vf tr" />
        <span className="vf bl" />
        <span className="vf br" />

        <div className="hero-copy">
          <div className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 32, height: 1, background: 'var(--mc-gold)' }} />
            Salon de coiffure &amp; barbier
          </div>
          <h1>
            L&apos;art de la coupe,
            <em>révélé avec précision.</em>
          </h1>
          <p>
            Chez Maitre Coif, chaque rendez-vous est pensé pour révéler votre style, dans un cadre élégant et attentif au
            détail.
          </p>
          <div className="cta-row">
            <Link className="btn btn-gold" href="/reservation">
              Réserver un rendez-vous <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link className="btn btn-ghost" href="/equipe">
              Découvrir l&apos;équipe
            </Link>
          </div>
        </div>

        <div className="hero-bar">
          <span>
            <span className="rec" />
            Scène 01 / 05<span className="hm"> · Ouverture</span>
          </span>
          <span className="mid">
            Défiler <ChevronDown className="size-3.5" style={{ color: 'var(--mc-gold)' }} aria-hidden="true" />
          </span>
          <span>
            Mar — Sam · 10h00 — 20h30<span className="hm"> · Sfax</span>
          </span>
        </div>
      </section>

      {bandeau.length > 0 && (
        <div className="mq" aria-hidden="true">
          <div className="mq-track">
            {[0, 1].map((g) => (
              <div className="mq-grp" key={g}>
                {bandeau.map((nom, i) => (
                  <span key={i} style={{ display: 'contents' }}>
                    <span>{nom}</span>
                    <i />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────── Scène 02 · Prestations ───────────── */}
      {services.length > 0 && (
        <section className="sec" data-scene="1" aria-labelledby="t-serv">
          <div className="wrap">
            <Reveal className="head-row">
              <div>
                <div className="lbl">Scène 02 / 05 · Nos prestations</div>
                <h2 className="h2" id="t-serv">
                  Cinq gestes, <em>une signature.</em>
                </h2>
              </div>
              <Link className="tlink" href="/services">
                Tous nos services <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Reveal>

            <Reveal className="film" delay={1}>
              <div className="perf" aria-hidden="true" />
              <div className="strip" style={{ '--n': services.length } as CSSProperties}>
                {services.map((s, i) => (
                  <article key={s.id} className="fr spotlit">
                    <div className="no" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <h3>{s.nom}</h3>
                      {s.description && <p>{s.description}</p>}
                      <Link className="tlink go" href={`/reservation?serviceId=${s.id}`}>
                        Réserver
                      </Link>
                    </div>
                    <div className="meta">
                      <span className="dur">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {s.duree} min
                      </span>
                      <b>{formatPrix(Number(s.prix))}</b>
                    </div>
                  </article>
                ))}
              </div>
              <div className="perf" aria-hidden="true" />
            </Reveal>
          </div>
        </section>
      )}

      {/* ───────────── Scène 03 · L'univers ───────────── */}
      <section className="sec" data-scene="2" style={{ paddingTop: 20 }} aria-labelledby="t-uni">
        <div className="wrap">
          <div className="uni">
            <Reveal className="ph">
              <Image
                className="ph-big"
                src={photoPrincipale?.url ?? '/maitre-coif-interieur.jpg'}
                alt={photoPrincipale?.legende || 'Mur de cadres du salon, affiche Maitre Coif Since 2005'}
                width={1400}
                height={1000}
                sizes="(min-width: 900px) 55vw, 100vw"
              />
              <Image
                className="ph-small"
                src={photoSecondaire?.url ?? '/maitre-coif-facade.jpg'}
                alt={photoSecondaire?.legende || "Détail de l'enseigne lumineuse"}
                width={680}
                height={450}
                sizes="340px"
              />
            </Reveal>
            <div style={{ position: 'relative' }}>
              <div className="ghost" aria-hidden="true">
                2005
              </div>
              <Reveal delay={1} className="relative">
                <div className="lbl">Scène 03 / 05 · L&apos;univers du salon</div>
                <h2 className="h2" id="t-uni" style={{ fontSize: 'clamp(38px,5vw,60px)' }}>
                  Un cadre pensé dans les <em>moindres détails.</em>
                </h2>
                <p className="lead" style={{ marginBottom: 30 }}>
                  Chez Maitre Coif, l&apos;expérience commence dès l&apos;entrée : une décoration soignée, une ambiance
                  chaleureuse et une équipe attentive à chaque détail, pour un moment qui vous ressemble.
                </p>
                <div className="fact">
                  <span className="lbl">Depuis 2005</span>
                  <span>Une adresse installée à Sfax, route Afran.</span>
                </div>
                <div className="fact">
                  <span className="lbl">Sur rendez-vous</span>
                  <span>Réservé à l&apos;avance, pour prendre le temps qu&apos;il faut.</span>
                </div>
                <div className="fact">
                  <span className="lbl">Salon &amp; barbier</span>
                  <span>Coupe, barbe, coloration et soins.</span>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Scène 04 · L'équipe ───────────── */}
      {equipe.length > 0 && (
        <section className="sec cast" data-scene="3" aria-labelledby="t-cast">
          <div className="wrap">
            <Reveal className="head-row">
              <div>
                <div className="lbl">Scène 04 / 05 · L&apos;équipe</div>
                <h2 className="h2" id="t-cast">
                  Rencontrez <em>nos coiffeurs.</em>
                </h2>
              </div>
              <Link className="tlink" href="/equipe">
                Toute l&apos;équipe <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Reveal>

            <div className="grid3">
              {equipe.map((c, i) => (
                <Reveal as="article" key={c.id} className="cc" delay={i}>
                  <div className="spot" />
                  <PortraitRond portrait={c.portrait} nom={`${c.prenom} ${c.nom}`} />
                  <h3>
                    {c.prenom} {c.nom}
                  </h3>
                  <div className="lbl" style={{ position: 'relative', marginTop: 12, fontSize: 10.5 }}>
                    {c.role === 'ADMIN' ? 'Gérant · Fondateur' : 'Coiffeur'}
                  </div>
                  {c.specialites.length > 0 && (
                    <div className="chips">
                      {c.specialites.slice(0, 3).map((sp) => (
                        <span className="chip" key={sp}>
                          {sp}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.bio && <p>{c.bio}</p>}
                  <Link className="tlink" href={`/reservation?coiffeurId=${c.id}`}>
                    Réserver avec {c.prenom} <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────────── Scène 05 · Critique ───────────── */}
      {avisAffiches.length > 0 && (
        <section className="sec crit" data-scene="4" aria-labelledby="t-crit">
          <div className="qmark" aria-hidden="true">
            “
          </div>
          <div className="wrap" style={{ position: 'relative' }}>
            <Reveal>
              <div className="lbl" id="t-crit">
                Scène 05 / 05 · Ils nous font confiance
              </div>
            </Reveal>
            <Reveal delay={1}>
              <ReviewCarousel avis={avisAffiches} />
            </Reveal>
            {moyenne !== null && (
              <Reveal delay={2}>
                <div style={{ marginTop: 34, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mc-muted)' }}>
                  Note moyenne {moyenne.toFixed(1).replace('.', ',')} / 5 · {nbAvis} avis
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ───────────── Final · Prise de rendez-vous ───────────── */}
      <section className="sec cta-sec" aria-labelledby="t-cta" style={{ paddingBlock: 'clamp(70px,9vw,110px)' }}>
        <div className="wrap">
          {prochaine && (
            <Reveal>
              <div className="pill">
                <span className="pulse" />
                <span>
                  Prochaine disponibilité : {libelleJour(prochaine.dateISO, prochaine.joursAvant)}, {prochaine.heure} avec{' '}
                  {prochaine.coiffeur}
                </span>
              </div>
            </Reveal>
          )}
          <Reveal as="h2" delay={1} className="h2" id="t-cta">
            Prêt à révéler <em>votre style ?</em>
          </Reveal>
          <Reveal delay={2} className="cta-final">
            <Link className="btn btn-gold" href="/reservation" style={{ height: 62, padding: '0 44px', fontSize: 13 }}>
              Réserver maintenant <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Reveal>
          <Reveal delay={3}>
            <div style={{ marginTop: 22, fontSize: 13, color: 'var(--mc-muted)' }}>
              Confirmation immédiate · Annulation possible jusqu&apos;à 2 h avant le rendez-vous
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
