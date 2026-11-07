-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "rappelEnvoye" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rendezVousId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Commande_rendezVousId_key" ON "Commande"("rendezVousId");

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE SET NULL ON UPDATE CASCADE;

