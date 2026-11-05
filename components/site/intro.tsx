import Image from 'next/image'

// Écran d'ouverture : le logo apparaît puis s'efface (1,5 s), une seule fois par
// session. Le contenu de la page est déjà dans le HTML (lecteurs d'écran,
// moteurs de recherche) ; le rideau est purement visuel.
//
// Le script s'exécute pendant l'analyse du HTML, avant le premier rendu : il
// affiche le rideau seulement à la première visite et sans mouvement réduit,
// donc pas de clignotement. Il ne s'exécute pas lors d'une navigation interne
// (retour à l'accueil depuis une autre page) : le rideau n'y revient jamais.
const SCRIPT = `try{var i=document.getElementById('mc-intro');if(i&&!sessionStorage.getItem('mc_intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){i.classList.add('show');sessionStorage.setItem('mc_intro','1')}}catch(e){}`

export function Intro() {
  return (
    <>
      <div id="mc-intro" className="intro" aria-hidden="true" suppressHydrationWarning>
        <Image src="/logo-gold.png" alt="" width={376} height={310} priority />
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  )
}
