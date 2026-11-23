/**
 * Projecteur de scène placé au-dessus de chaque coiffeur (accueil, « Rencontrez nos coiffeurs »).
 * Dessin vectoriel : aucune image à charger. La lentille et le halo ne s'allument qu'avec le coiffeur
 * (survol sur ordinateur, classe « lit » sur téléphone) : voir cinema-home.css.
 */

/** Dégradés partagés par tous les projecteurs : à placer une seule fois dans la section. */
export function ProjecteurDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pj-metal" x1="0" x2="1">
          <stop offset="0" stopColor="#2c2a26" />
          <stop offset=".45" stopColor="#6b665b" />
          <stop offset="1" stopColor="#2a2824" />
        </linearGradient>
        <linearGradient id="pj-corps" x1="0" x2="1">
          <stop offset="0" stopColor="#181714" />
          <stop offset=".35" stopColor="#46423a" />
          <stop offset=".7" stopColor="#26241f" />
          <stop offset="1" stopColor="#12110f" />
        </linearGradient>
        <radialGradient id="pj-lentille">
          <stop offset="0" stopColor="#fffdf2" />
          <stop offset=".55" stopColor="#ffe8a8" />
          <stop offset="1" stopColor="#d4af37" />
        </radialGradient>
        <radialGradient id="pj-halo">
          <stop offset="0" stopColor="rgba(255,243,214,.85)" />
          <stop offset=".5" stopColor="rgba(255,243,214,.25)" />
          <stop offset="1" stopColor="rgba(255,243,214,0)" />
        </radialGradient>
      </defs>
    </svg>
  )
}

export function Projecteur() {
  return (
    <>
      {/* Tige jusqu'au rail du plafond (ordinateur) et petit support (téléphone) : dessinés en CSS */}
      <span className="pj-tige" aria-hidden="true" />
      <span className="pj-support" aria-hidden="true" />
      <svg className="pj" viewBox="0 0 84 92" aria-hidden="true" focusable="false">
        <rect x="38" y="0" width="8" height="22" fill="url(#pj-metal)" />
        <circle cx="42" cy="22" r="6" fill="url(#pj-metal)" />
        <path d="M27 29 H57 L66 73 H18 Z" fill="url(#pj-corps)" />
        <path d="M27 29 H57" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
        <rect x="14" y="72" width="56" height="9" rx="3" fill="url(#pj-metal)" />
        <ellipse cx="42" cy="82" rx="26" ry="6.4" fill="#17150f" />
        <ellipse className="pj-eteint" cx="42" cy="82" rx="23" ry="4.8" fill="#3a332a" />
        <ellipse className="pj-allume" cx="42" cy="82" rx="23" ry="4.8" fill="url(#pj-lentille)" />
        <ellipse className="pj-halo" cx="42" cy="86" rx="40" ry="14" fill="url(#pj-halo)" />
      </svg>
    </>
  )
}
