import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'

import { BoutiqueAccueil } from '@/components/boutique/accueil'
import { Cinema } from '@/components/site/cinema'
import { Intro } from '@/components/site/intro'
import { Localisation } from '@/components/site/localisation'
import { PortraitRond } from '@/components/site/portrait'
import { Reveal } from '@/components/site/reveal'
import { ReviewCarousel, type AvisAffiche } from '@/components/site/review-carousel'
import { chargerCatalogue } from '@/lib/boutique'
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
  const [tousLesServices, coiffeurs, avis, statsAvis, photosSalon, prochaine, boutique] = await Promise.all([
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
    prisma.photoSalon.findMany({ orderBy: [{ ordre: 'asc' }, { dateCreation: 'asc' }], take: 5, select: { id: true, legende: true } }),
    prochaineDisponibilite().catch(() => null),
    // La boutique ne doit jamais empêcher l'accueil de s'afficher.
    chargerCatalogue().catch(() => ({ produits: [], packs: [] })),
  ])

  return { tousLesServices, coiffeurs, avis, statsAvis, photosSalon, prochaine, boutique }
}

export default async function AccueilPage() {
  const { tousLesServices, coiffeurs, avis, statsAvis, photosSalon, prochaine, boutique } = await getAccueilData()

  // Quelques produits disponibles d'abord, puis les packs du moment.
  const produitsVedette = [...boutique.produits].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)).slice(0, 4)
  const packsVedette = boutique.packs.slice(0, 3)

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

      {/* Ouverture */}
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
            <Link className="btn btn-gold" href="/reservation" data-ph="reserver-accueil">
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

      {/* Prestations */}
      {services.length > 0 && (
        <section className="h-reel" data-scene="1" data-pin style={{ '--n': services.length } as CSSProperties} aria-labelledby="t-serv">
          <div className="h-stage">
            <div className="h-reel-head">
              <div>
                <div className="lbl">Nos prestations</div>
                <h2 className="h2" id="t-serv">
                  Cinq gestes, <em>une signature.</em>
                </h2>
              </div>
              <Link className="tlink" href="/services" data-ph="tous-les-services">
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
                    <Link className="tlink" href={`/reservation?serviceId=${s.id}`} style={{ marginTop: 18 }} data-ph="reserver-prestation">
                      Réserver <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* L'univers */}
      <section className="h-uni" data-scene="2" data-track aria-labelledby="t-uni">
        <div className="h-uni-media">
          <Image
            src={photoPrincipale ? `/api/galerie/${photoPrincipale.id}/image` : '/maitre-coif-interieur.jpg'}
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
            Notre enseigne
          </span>
          <Image
            src={photoSecondaire ? `/api/galerie/${photoSecondaire.id}/image` : '/maitre-coif-facade.jpg'}
            alt={photoSecondaire?.legende || "Détail de l'enseigne lumineuse"}
            fill
            sizes="340px"
          />
        </div>

        <div className="h-uni-copy">
          <Reveal>
            <div className="lbl">Le salon</div>
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

      {/* Galerie : les 5 premières photos, même mouvement que les prestations */}
      {photosSalon.length > 0 && (
        <section className="h-reel" data-scene="3" data-pin style={{ '--n': photosSalon.length + 1 } as CSSProperties} aria-labelledby="t-gal">
          <div className="h-stage">
            <div className="h-reel-head">
              <div>
                <div className="lbl">La galerie</div>
                <h2 className="h2" id="t-gal">
                  Le salon <em>en images.</em>
                </h2>
              </div>
              <Link className="tlink" href="/galerie" data-ph="toute-la-galerie">
                Toute la galerie <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="h-strip">
              {photosSalon.map((photo, i) => (
                <article key={photo.id} className="h-card ph" data-depth>
                  <Image
                    src={`/api/galerie/${photo.id}/image`}
                    alt={photo.legende || `Photo ${i + 1} du salon Maitre Coif`}
                    fill
                    sizes="(max-width: 760px) 80vw, 440px"
                    className="ph-img"
                  />
                  <span className="shade" aria-hidden="true" />
                  <span className="flare" />
                  <div className="no" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  {photo.legende && <p className="legend">{photo.legende}</p>}
                </article>
              ))}
              <article className="h-card all" data-depth>
                <span className="flare" />
                <div className="no" aria-hidden="true">
                  +
                </div>
                <div>
                  <h3>Toute la galerie</h3>
                  <p>Retrouvez toutes les photos du salon et de nos réalisations.</p>
                  <Link className="btn btn-gold" href="/galerie" style={{ marginTop: 22 }} data-ph="toute-la-galerie">
                    Voir toute la galerie <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>
      )}

      {/* La boutique : produits et packs */}
      <BoutiqueAccueil produits={produitsVedette} packs={packsVedette} />

      {/* L'équipe */}
      {equipe.length > 0 && (
        <section className="h-cast" data-scene="4" data-track aria-labelledby="t-cast">
          <div className="h-cast-word" aria-hidden="true">
            ÉQUIPE
          </div>
          <div className="wrap">
            <Reveal className="head-row">
              <div>
                <div className="lbl">L&apos;équipe</div>
                <h2 className="h2" id="t-cast">
                  Rencontrez <em>nos coiffeurs.</em>
                </h2>
              </div>
              <Link className="tlink" href="/equipe" data-ph="toute-l-equipe">
                Toute l&apos;équipe <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Reveal>

            <div className="h-cast-grid">
              {equipe.map((c, i) => (
                <Reveal as="article" key={c.id} className="h-cs" delay={i}>
                  <div className="tag">
                    <b>{c.role === 'ADMIN' ? 'Gérant · Fondateur' : 'Coiffeur'}</b>
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
                  <Link className="tlink" href={`/reservation?coiffeurId=${c.id}`} data-ph="reserver-coiffeur">
                    Réserver avec {c.prenom} <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* La critique */}
      {avisAffiches.length > 0 && (
        <section className="h-crit" data-scene="5" data-track aria-labelledby="t-crit">
          <div className="qmark" aria-hidden="true">
            “
          </div>
          <div className="wrap" style={{ position: 'relative' }}>
            <Reveal>
              <div className="lbl" id="t-crit">
                Ils nous font confiance
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

      {/* Fin */}
      <section className="h-end" data-scene="6" aria-labelledby="t-cta">
        <div className="wrap">
          <Reveal>
            <div className="h-next">
              <small>{prochaine ? 'Prochaine disponibilité' : 'Disponibilité'}</small>
              <strong>{prochaine ? `${libelleJour(prochaine.dateISO, prochaine.joursAvant)}, ${prochaine.heure}` : 'Sur rendez-vous'}</strong>
              {prochaine && <span>avec {prochaine.coiffeur}</span>}
            </div>
          </Reveal>

          <Reveal as="h2" delay={1} className="h-title-end" id="t-cta">
            Prêt à révéler <em>votre style ?</em>
          </Reveal>
          <Reveal delay={2} className="cta-final">
            <Link className="btn btn-gold" href="/reservation" style={{ height: 62, padding: '0 44px', fontSize: 13 }} data-ph="reserver-fin">
              Réserver mon rendez-vous <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Reveal>
          <Reveal delay={3}>
            <div style={{ marginTop: 22, fontSize: 13, color: 'var(--mc-muted)' }}>
              Confirmation immédiate · Annulation possible jusqu&apos;à 2 h avant le rendez-vous
            </div>
          </Reveal>
        </div>
      </section>

      {/* Où nous trouver */}
      <Localisation />
    </main>
  )
}
