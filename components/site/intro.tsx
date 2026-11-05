import Image from 'next/image'

// Rideau d'ouverture : le logo apparaît sur fond noir, puis deux bandes noires
// s'écartent et révèlent le premier plan. Une seule fois par session (1,7 s).
// Le contenu de la page est déjà dans le HTML (lecteurs d'écran, moteurs de
// recherche) ; le rideau est purement visuel.
//
// Le script s'exécute pendant l'analyse du HTML, avant le premier rendu : il
// affiche le rideau seulement à la première visite et sans mouvement réduit,
// donc pas de clignotement. Il ne modifie QUE le rideau (jamais <html> ni un
// élément géré par React ailleurs : cela provoquerait une erreur d'hydratation).
// Le retard des animations du premier plan se déduit en CSS du rideau affiché
// (`.intro.show ~ .h-hero`). Il ne s'exécute pas lors d'une navigation interne :
// le rideau n'y revient jamais.
const SCRIPT = `try{var i=document.getElementById('mc-intro');if(i&&!sessionStorage.getItem('mc_intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){i.classList.add('show');sessionStorage.setItem('mc_intro','1')}}catch(e){}`

export function Intro() {
  return (
    <>
      <div id="mc-intro" className="intro" aria-hidden="true" suppressHydrationWarning>
        <i />
        <i />
        <Image src="/logo-gold.png" alt="" width={376} height={310} priority />
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  )
}
