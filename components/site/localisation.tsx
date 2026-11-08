import { MapPin, Navigation } from 'lucide-react'

import { Reveal } from '@/components/site/reveal'
import { SALON_ADRESSE, SALON_CARTE_URL, SALON_FICHE_URL, SALON_ITINERAIRE_URL } from '@/lib/salon-lieu'

// Dernière scène de l'accueil : où trouver le salon, avec un bouton d'itinéraire.
export function Localisation() {
  return (
    <section className="loc" data-scene="8" aria-labelledby="t-loc">
      <div className="wrap">
        <Reveal className="loc-head">
          <div className="lbl">Nous trouver</div>
          <h2 className="h2" id="t-loc">
            Venez nous <em>rendre visite.</em>
          </h2>
          <p className="loc-addr">
            <MapPin className="size-4" aria-hidden="true" /> {SALON_ADRESSE}
          </p>
        </Reveal>

        <Reveal delay={1} className="loc-map">
          <iframe
            title="Carte : emplacement du salon Maitre Coif à Sfax"
            src={SALON_CARTE_URL}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </Reveal>

        <Reveal delay={2} className="loc-cta">
          <a className="btn btn-gold" href={SALON_ITINERAIRE_URL} target="_blank" rel="noopener noreferrer" data-ph="itineraire">
            <Navigation className="size-4" aria-hidden="true" /> Obtenir l&apos;itinéraire
          </a>
          <a className="btn btn-ghost" href={SALON_FICHE_URL} target="_blank" rel="noopener noreferrer" data-ph="fiche-google-maps">
            Ouvrir dans Google Maps
          </a>
        </Reveal>
      </div>
    </section>
  )
}
