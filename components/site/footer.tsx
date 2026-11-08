import { ThemeLogo } from '@/components/theme-logo'

import { getHorairesSalon } from '@/lib/horaires'
import { prisma } from '@/lib/prisma'

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" {...props}>
      <path d="M15 8.5h2V5.2h-2.2C12.4 5.2 11 6.6 11 9v2H9v3.3h2V21h3.3v-6.7h2.4l.6-3.3h-3V9c0-.4.2-.5.7-.5Z" />
    </svg>
  )
}

// Pied de page en « générique de fin ».
export async function Footer() {
  const [equipe, gerants, horaires] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['COIFFEUR', 'ADMIN'] }, actif: true },
      orderBy: { dateCreation: 'asc' },
      select: { prenom: true, nom: true },
      take: 6,
    }),
    // Seuls les gérants affichent leur numéro : pas celui des autres coiffeurs.
    prisma.user.findMany({
      where: { role: 'ADMIN', actif: true, telephone: { not: null } },
      orderBy: { dateCreation: 'asc' },
      select: { prenom: true, nom: true, telephone: true },
    }),
    getHorairesSalon(),
  ])
  const [premier, ...autres] = equipe.map((m) => `${m.prenom} ${m.nom}`)
  const contacts = gerants.filter((g) => g.telephone?.trim())
  const colonnes = 2 + (contacts.length > 0 ? 1 : 0) + (premier ? 1 : 0)

  return (
    <footer className="foot">
      <div className="wrap">
        <ThemeLogo className="logo-f" />

        <div className="cred" style={{ '--cols': colonnes } as React.CSSProperties}>
          <div>
            <div className="lbl">L&apos;adresse</div>
            <p>
              Route Afran Km 5<small>Sfax, Tunisie</small>
            </p>
          </div>
          <div>
            <div className="lbl">Horaires</div>
            {horaires.length > 0 ? (
              horaires.map((h) => (
                <p key={h.jours}>
                  {h.jours}
                  <small>{h.heures}</small>
                </p>
              ))
            ) : (
              <p>Sur rendez-vous</p>
            )}
            <small>Sur rendez-vous uniquement</small>
          </div>
          {contacts.length > 0 && (
            <div>
              <div className="lbl">{contacts.length > 1 ? 'Contacts' : 'Contact'}</div>
              {contacts.map((g) => (
                <p key={g.telephone}>
                  <a href={`tel:${g.telephone!.replace(/[^\d+]/g, '')}`}>{g.telephone}</a>
                  <small>
                    {g.prenom} {g.nom} · Gérant
                  </small>
                </p>
              ))}
            </div>
          )}
          {premier && (
            <div>
              <div className="lbl">L&apos;équipe</div>
              <p>
                {premier}
                {autres.length > 0 && <small>{autres.join(' · ')}</small>}
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: 38 }}>
          <a className="soc" href="https://www.instagram.com/maitrecoif/" target="_blank" rel="noreferrer" aria-label="Instagram">
            <InstagramIcon width={18} height={18} />
          </a>
          <a
            className="soc"
            href="https://www.facebook.com/profile.php?id=100064083337227"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
          >
            <FacebookIcon width={18} height={18} />
          </a>
        </div>

        <div className="legal">
          <span>© {new Date().getFullYear()} Maitre Coif</span>
          <span>Sfax · Tunisie</span>
        </div>
      </div>
    </footer>
  )
}
