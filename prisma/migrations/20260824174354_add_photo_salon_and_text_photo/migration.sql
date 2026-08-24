-- CreateTable
CREATE TABLE "PhotoSalon" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "legende" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoSalon_pkey" PRIMARY KEY ("id")
);
