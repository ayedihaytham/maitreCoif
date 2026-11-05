-- Plusieurs prestations par rendez-vous.
CREATE TABLE "RendezVousService" (
    "rendezVousId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "duree" INTEGER NOT NULL,

    CONSTRAINT "RendezVousService_pkey" PRIMARY KEY ("rendezVousId","serviceId")
);

CREATE INDEX "RendezVousService_serviceId_idx" ON "RendezVousService"("serviceId");

ALTER TABLE "RendezVousService" ADD CONSTRAINT "RendezVousService_rendezVousId_fkey" FOREIGN KEY ("rendezVousId") REFERENCES "RendezVous"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RendezVousService" ADD CONSTRAINT "RendezVousService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reprise de l'existant : chaque rendez-vous actuel reçoit sa prestation unique.
INSERT INTO "RendezVousService" ("rendezVousId","serviceId","ordre","nom","prix","duree")
SELECT r."id", r."serviceId", 0, s."nom", s."prix", s."duree"
FROM "RendezVous" r JOIN "Service" s ON s."id" = r."serviceId";
