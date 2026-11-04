-- CreateTable
CREATE TABLE "Fermeture" (
    "id" TEXT NOT NULL,
    "coiffeurId" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fermeture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeModification" (
    "id" TEXT NOT NULL,
    "rendezVousId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "traitee" BOOLEAN NOT NULL DEFAULT false,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandeModification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fermeture_dateDebut_dateFin_idx" ON "Fermeture"("dateDebut", "dateFin");

-- CreateIndex
CREATE INDEX "Fermeture_coiffeurId_idx" ON "Fermeture"("coiffeurId");

-- CreateIndex
CREATE INDEX "DemandeModification_rendezVousId_traitee_idx" ON "DemandeModification"("rendezVousId", "traitee");

-- AddForeignKey
ALTER TABLE "Fermeture" ADD CONSTRAINT "Fermeture_coiffeurId_fkey" FOREIGN KEY ("coiffeurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeModification" ADD CONSTRAINT "DemandeModification_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE CASCADE ON UPDATE CASCADE;
