import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'

import { Cinema } from '@/components/site/cinema'
import { Intro } from '@/components/site/intro'
import { PortraitRond } from '@/components/site/portrait'
import { Reveal } from '@/components/site/reveal'
import { ReviewCarousel, type AvisAffiche } from '@/components/site/review-carousel'
import { attribuerPortraits } from '@/lib/portraits'
import { libelleJour, prochaineDisponibilite } from '@/lib/prochaine-disponibilite'
import { prisma } from '@/lib/prisma'
import { inclurePrestations, prestationsDuRendezVous } from '@/lib/prestations'
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
            ...inclurePrestations,
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
    meta: `${prestationsDuRendezVous(a.rendezVous).nom} · avec ${a.rendezVous.coiffeur.prenom} ${a.rendezVous.coiffeur.nom}`,
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
      <Cinema />

      {/* ═════════ PLAN 1 · OUVERTURE — plan large : la lumière suit le regard ═════════ */}
      <section className="h-hero" data-scene="0" data-track="out" aria-label="Ouverture">
        <div className="h-media">
          <Image
            src="/maitre-coif-facade.jpg"
            alt="Enseigne lumineuse Maitre Coif, en lettres rétro-éclairées"
            fill
            preload
            sizes="100vw"
          />
        </div>
        <div className="h-dark" />
        <div className="h-light" />
        <div className="h-streak" />
        <div className="h-shade" />
        <span className="h-vf tl" />
        <span className="h-vf tr" />
        <span className="h-vf bl" />
        <span className="h-vf br" />
        <div className="h-slate" aria-hidden="true">
          <b>SC. 01</b> · PRISE 1<br />
          EXT. SALON — SOIR
        </div>

        <div className="h-copy">
          <div className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 32, height: 1, background: 'var(--mc-gold)' }} />
            Salon de coiffure &amp; barbier
          </div>
          <h1 className="h-title">
            <span className="ln" style={{ '--i': 0 } as CSSProperties}>
              <span>L&apos;art de la coupe,</span>
            </span>
            <span className="ln gold" style={{ '--i': 1 } as CSSProperties}>
              <span>révélé avec</span>
            </span>
            <span className="ln gold" style={{ '--i': 2 } as CSSProperties}>
              <span>précision.</span>
            </span>
          </h1>
          <p className="h-sub">
            Chez Maitre Coif, chaque rendez-vous est pensé pour révéler votre style, dans un cadre élégant et attentif au
            détail.
          </p>
          <div className="h-cta">
            <Link className="btn btn-gold" href="/reservation">
              Réserver un rendez-vous <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link className="btn btn-ghost" href="/equipe">
              Découvrir l&apos;équipe
            </Link>
          </div>
        </div>
        <div className="h-scroll" aria-hidden="true">
          Défiler
          <i />
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

      {/* ═════════ PLAN 2 · PRESTATIONS — la pellicule défile, seule la vignette au centre est nette ═════════ */}
      {services.length > 0 && (
        <section className="h-reel" data-scene="1" data-pin style={{ '--n': services.length } as CSSProperties} aria-labelledby="t-serv">
          <div className="h-stage">
            <div className="h-reel-head">
              <div>
                <div className="lbl">Scène 02 / 05 · Nos prestations</div>
                <h2 className="h2" id="t-serv">
                  Cinq gestes, <em>une signature.</em>
                </h2>
              </div>
              <Link className="tlink" href="/services">
                Tous nos services <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="h-strip">
              {services.map((s, i) => (
                <article key={s.id} className="h-card" data-depth>
                  <span className="flare" />
                  <div className="no" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <h3>{s.nom}</h3>
                    {s.description && <p>{s.description}</p>}
                    <div className="meta">
                      <span className="dur" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Clock className="size-3.5" aria-hidden="true" />
                        {s.duree} min
                      </span>
                      <b>{formatPrix(Number(s.prix))}</b>
                    </div>
                    <Link className="tlink" href={`/reservation?serviceId=${s.id}`} style={{ marginTop: 18 }}>
                      Réserver <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═════════ PLAN 3 · L'UNIVERS — plan d'insertion plein cadre, texte en sous-titres ═════════ */}
      <section className="h-uni" data-scene="2" data-track aria-labelledby="t-uni">
        <div className="h-uni-media">
          <Image
            src={photoPrincipale?.url ?? '/maitre-coif-interieur.jpg'}
            alt={photoPrincipale?.legende || 'Mur de cadres du salon, affiche Maitre Coif Since 2005'}
            fill
            sizes="100vw"
          />
        </div>
        <div className="h-ghost" aria-hidden="true">
          2005
        </div>
        <div className="h-pip">
          <span>
            <i className="rec" /> Enseigne · direct
          </span>
          <Image
            src={photoSecondaire?.url ?? '/maitre-coif-facade.jpg'}
            alt={photoSecondaire?.legende || "Détail de l'enseigne lumineuse"}
            fill
            sizes="340px"
          />
        </div>

        <div className="h-uni-copy">
          <Reveal>
            <div className="lbl">Scène 03 / 05 · L&apos;univers du salon</div>
          </Reveal>
          <Reveal as="h2" delay={1} className="h2" id="t-uni">
            Un cadre pensé dans les <em>moindres détails.</em>
          </Reveal>
          <Reveal as="p" delay={2} className="h-subs">
            <span>
              Chez Maitre Coif, l&apos;expérience commence dès l&apos;entrée : une décoration soignée, une ambiance chaleureuse
              et une équipe attentive à chaque détail, pour un moment qui vous ressemble.
            </span>
          </Reveal>
          <Reveal delay={3} className="h-facts">
            <div>
              <span className="lbl">Depuis 2005</span>
              Une adresse installée à Sfax, route Afran.
            </div>
            <div>
              <span className="lbl">Sur rendez-vous</span>
              Réservé à l&apos;avance, pour prendre le temps qu&apos;il faut.
            </div>
            <div>
              <span className="lbl">Salon &amp; barbier</span>
              Coupe, barbe, coloration et soins.
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═════════ PLAN 4 · LE CASTING — essais caméra, un projecteur par personne ═════════ */}
      {equipe.length > 0 && (
        <section className="h-cast" data-scene="3" data-track aria-labelledby="t-cast">
          <div className="h-cast-word" aria-hidden="true">
            CASTING
          </div>
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

            <div className="h-cast-grid">
              {equipe.map((c, i) => (
                <Reveal as="article" key={c.id} className="h-cs" delay={i}>
                  <div className="tag">
                    <b>Essai {String(i + 1).padStart(2, '0')}</b> · {c.role === 'ADMIN' ? 'Gérant · Fondateur' : 'Coiffeur'}
                  </div>
                  <PortraitRond portrait={c.portrait} nom={`${c.prenom} ${c.nom}`} />
                  <h3>
                    {c.prenom} {c.nom}
                  </h3>
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

      {/* ═════════ PLAN 5 · LA CRITIQUE — la parole d'un client, en sous-titres ═════════ */}
      {avisAffiches.length > 0 && (
        <section className="h-crit" data-scene="4" data-track aria-labelledby="t-crit">
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

      {/* ═════════ PLAN 6 · FIN — le clap : la prochaine prise est la vôtre ═════════ */}
      <section className="h-end" data-scene="5" aria-labelledby="t-cta">
        <div className="wrap">
          <Reveal>
            <div className="h-clap" role="img" aria-label="Clap de cinéma : prochaine prise disponible">
              <div className="h-clap-arm" />
              <div className="h-clap-base" />
              <div className="h-clap-board">
                <div className="wide">
                  <small>Production</small>
                  <strong>Maitre Coif</strong>
                </div>
                <div>
                  <small>Scène</small>
                  <strong>Votre style</strong>
                </div>
                <div>
                  <small>Prise</small>
                  <strong className="gold">N° 1</strong>
                </div>
                <div className="wide">
                  <small>{prochaine ? 'Prochaine disponibilité' : 'Disponibilité'}</small>
                  <strong className="gold">
                    {prochaine ? `${libelleJour(prochaine.dateISO, prochaine.joursAvant)}, ${prochaine.heure}` : 'Sur rendez-vous'}
                  </strong>
                  {prochaine && <small style={{ marginTop: 6 }}>avec {prochaine.coiffeur}</small>}
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal as="h2" delay={1} className="h-title-end" id="t-cta">
            Prêt à révéler <em>votre style ?</em>
          </Reveal>
          <Reveal delay={2} className="cta-final">
            <Link className="btn btn-gold" href="/reservation" style={{ height: 62, padding: '0 44px', fontSize: 13 }}>
              Réserver ma séance <ArrowRight className="size-4" aria-hidden="true" />
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
