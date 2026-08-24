import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function hash(password: string) {
  return bcrypt.hash(password, 12)
}

async function main() {
  console.log('Seed: suppression des données existantes...')
  await prisma.avis.deleteMany()
  await prisma.rendezVous.deleteMany()
  await prisma.disponibilite.deleteMany()
  await prisma.service.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.user.deleteMany()

  console.log('Seed: création des services...')
  const services = await Promise.all(
    [
      { nom: 'Coupe classique', description: 'Coupe aux ciseaux et à la tondeuse, finitions soignées.', prix: 20, duree: 30, categorie: 'Coupe' },
      { nom: 'Coupe & barbe', description: 'Coupe complète et taille de barbe avec rasoir chaud.', prix: 30, duree: 45, categorie: 'Coupe' },
      { nom: 'Taille de barbe', description: 'Dessin et taille de barbe, contours au rasoir.', prix: 12, duree: 20, categorie: 'Barbe' },
      { nom: 'Coloration', description: 'Coloration complète, produits professionnels.', prix: 45, duree: 60, categorie: 'Couleur' },
      { nom: 'Soin capillaire', description: 'Soin profond hydratant et massage du cuir chevelu.', prix: 20, duree: 30, categorie: 'Soin' },
    ].map((s) => prisma.service.create({ data: s })),
  )

  console.log('Seed: création du gérant (administrateur)...')
  const gerant = await prisma.user.create({
    data: {
      nom: 'Martin',
      prenom: 'Thomas',
      email: 'gerant@maitrecoif.fr',
      telephone: '0601020304',
      motDePasseHash: await hash('Gerant123!'),
      role: 'ADMIN',
      photo: '/maitre-coif-team.png',
      specialites: ['Coupe & barbe', 'Coloration'],
      bio: "Fondateur de Maitre Coif, plus de 15 ans d'expérience.",
    },
  })

  console.log('Seed: création des coiffeurs...')
  const coiffeurs = await Promise.all([
    prisma.user.create({
      data: {
        nom: 'Moreau',
        prenom: 'Julien',
        email: 'julien@maitrecoif.fr',
        telephone: '0601020305',
        motDePasseHash: await hash('Coiffeur123!'),
        role: 'COIFFEUR',
        photo: '/maitre-coif-team.png',
        specialites: ['Coupes modernes'],
        bio: 'Spécialiste des coupes tendances et du dégradé.',
      },
    }),
    prisma.user.create({
      data: {
        nom: 'Bernard',
        prenom: 'Lucas',
        email: 'lucas@maitrecoif.fr',
        telephone: '0601020306',
        motDePasseHash: await hash('Coiffeur123!'),
        role: 'COIFFEUR',
        photo: '/maitre-coif-team.png',
        specialites: ['Barbe & soins'],
        bio: 'Expert du rasage traditionnel et des soins de barbe.',
      },
    }),
  ])

  const tousLesCoiffeurs = [gerant, ...coiffeurs]

  console.log('Seed: création des disponibilités (mardi-samedi, 10h-19h30)...')
  for (const coiffeur of tousLesCoiffeurs) {
    for (const jour of [2, 3, 4, 5, 6]) {
      await prisma.disponibilite.create({
        data: { coiffeurId: coiffeur.id, jourSemaine: jour, heureDebut: '10:00', heureFin: '19:30' },
      })
    }
  }

  console.log('Seed: création d\'un client de démonstration...')
  const client = await prisma.user.create({
    data: {
      nom: 'Dupont',
      prenom: 'Camille',
      email: 'client@example.com',
      telephone: '0611223344',
      motDePasseHash: await hash('Client123!'),
      role: 'CLIENT',
    },
  })

  console.log('Seed: création de rendez-vous de démonstration...')
  const hier = new Date()
  hier.setDate(hier.getDate() - 1)
  hier.setUTCHours(0, 0, 0, 0)

  const rdvTermine = await prisma.rendezVous.create({
    data: {
      codeSuivi: 'MC-DEMO01',
      coiffeurId: coiffeurs[0].id,
      serviceId: services[1].id,
      clientUserId: client.id,
      clientNom: 'Camille Dupont',
      clientTelephone: '0611223344',
      clientEmail: 'client@example.com',
      date: hier,
      heureDebut: '14:00',
      heureFin: '14:45',
      statut: 'TERMINE',
    },
  })

  await prisma.avis.create({
    data: { rendezVousId: rdvTermine.id, note: 5, commentaire: 'Excellent accueil, coupe impeccable !' },
  })

  const demain = new Date()
  demain.setDate(demain.getDate() + 1)
  demain.setUTCHours(0, 0, 0, 0)

  await prisma.rendezVous.create({
    data: {
      codeSuivi: 'MC-DEMO02',
      coiffeurId: gerant.id,
      serviceId: services[0].id,
      clientNom: 'Marc Petit',
      clientTelephone: '0699887766',
      date: demain,
      heureDebut: '11:00',
      heureFin: '11:30',
      statut: 'EN_ATTENTE',
    },
  })

  console.log('Seed terminé.')
  console.log('  Admin/gérant : gerant@maitrecoif.fr / Gerant123!')
  console.log('  Coiffeur     : julien@maitrecoif.fr / Coiffeur123!')
  console.log('  Client       : client@example.com / Client123!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
