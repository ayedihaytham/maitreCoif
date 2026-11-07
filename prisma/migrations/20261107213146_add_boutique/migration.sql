-- CreateEnum
CREATE TYPE "RemisePack" AS ENUM ('POURCENTAGE', 'PRIX_FIXE');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('A_PREPARER', 'PRETE', 'RETIREE', 'ANNULEE', 'EXPIREE');

-- CreateEnum
CREATE TYPE "TypeLigneCommande" AS ENUM ('PRODUIT', 'PACK');

-- CreateTable
CREATE TABLE "Produit" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "prix" DECIMAL(10,2) NOT NULL,
    "categorie" TEXT,
    "image" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "miseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "remiseType" "RemisePack" NOT NULL DEFAULT 'POURCENTAGE',
    "remiseValeur" DECIMAL(10,2) NOT NULL,
    "debut" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackLigne" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "produitId" TEXT,
    "serviceId" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackLigne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commande" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statut" "StatutCommande" NOT NULL DEFAULT 'A_PREPARER',
    "clientNom" TEXT NOT NULL,
    "clientTelephone" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "retrait" TEXT NOT NULL DEFAULT 'SALON',
    "jourSouhaite" TEXT,
    "notes" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "economie" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "preteLe" TIMESTAMP(3),
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "miseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeLigne" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "type" "TypeLigneCommande" NOT NULL,
    "produitId" TEXT,
    "packId" TEXT,
    "nom" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(10,2) NOT NULL,
    "prixNormalUnitaire" DECIMAL(10,2) NOT NULL,
    "detail" JSONB,

    CONSTRAINT "CommandeLigne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Produit_actif_idx" ON "Produit"("actif");

-- CreateIndex
CREATE INDEX "Pack_actif_idx" ON "Pack"("actif");

-- CreateIndex
CREATE INDEX "PackLigne_packId_idx" ON "PackLigne"("packId");

-- CreateIndex
CREATE INDEX "PackLigne_produitId_idx" ON "PackLigne"("produitId");

-- CreateIndex
CREATE INDEX "PackLigne_serviceId_idx" ON "PackLigne"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Commande_code_key" ON "Commande"("code");

-- CreateIndex
CREATE INDEX "Commande_statut_dateCreation_idx" ON "Commande"("statut", "dateCreation");

-- CreateIndex
CREATE INDEX "CommandeLigne_commandeId_idx" ON "CommandeLigne"("commandeId");

-- CreateIndex
CREATE INDEX "CommandeLigne_produitId_idx" ON "CommandeLigne"("produitId");

-- CreateIndex
CREATE INDEX "CommandeLigne_packId_idx" ON "CommandeLigne"("packId");

-- AddForeignKey
ALTER TABLE "PackLigne" ADD CONSTRAINT "PackLigne_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackLigne" ADD CONSTRAINT "PackLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackLigne" ADD CONSTRAINT "PackLigne_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeLigne" ADD CONSTRAINT "CommandeLigne_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeLigne" ADD CONSTRAINT "CommandeLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeLigne" ADD CONSTRAINT "CommandeLigne_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
