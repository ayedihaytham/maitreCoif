// Ajoute (ou met à jour) un compte gérant SANS toucher aux autres données : contrairement à `db:seed`, qui efface
// toute la base, ce script peut être lancé en toute sécurité sur la base de production.
//   pnpm db:gerant                      -> maitrecoif@gmail.com
//   pnpm db:gerant autre@exemple.com    -> une autre adresse
// Le gérant se connecte ensuite via Clerk avec cette même adresse (invitation ou inscription sur le sous-domaine du salon).
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

const prisma = new PrismaClient()
const email = (process.argv[2] ?? 'maitrecoif@gmail.com').trim().toLowerCase()

async function main() {
  const existant = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  if (existant && existant.role === 'CLIENT') {
    throw new Error(`${email} est déjà un compte client : choisissez une autre adresse.`)
  }

  const gerant = existant
    ? await prisma.user.update({ where: { id: existant.id }, data: { role: 'ADMIN', actif: true } })
    : await prisma.user.create({
        data: {
          nom: 'Coif',
          prenom: 'Maitre',
          email,
          motDePasseHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12), // inutilisable : l'accès passe par Clerk
          role: 'ADMIN',
          specialites: ['Gestion du salon'],
          bio: 'Compte gérant du salon.',
        },
      })

  // Mêmes horaires que le reste de l'équipe (mardi — samedi), seulement si aucun n'est encore défini.
  if ((await prisma.disponibilite.count({ where: { coiffeurId: gerant.id } })) === 0) {
    await prisma.disponibilite.createMany({
      data: [2, 3, 4, 5, 6].map((jourSemaine) => ({ coiffeurId: gerant.id, jourSemaine, heureDebut: '10:00', heureFin: '19:30' })),
    })
  }

  console.log(`${existant ? 'Mis à jour' : 'Créé'} : ${gerant.email} (gérant). Connexion via Clerk avec cette adresse.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
