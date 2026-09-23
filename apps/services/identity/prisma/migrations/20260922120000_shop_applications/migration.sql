-- CreateEnum
CREATE TYPE "shop_application_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_ACTION');

-- CreateEnum
CREATE TYPE "shop_application_document_type" AS ENUM ('CAC_CERTIFICATE', 'OWNER_ID', 'PROOF_OF_ADDRESS', 'PREMISES_PHOTO');

-- CreateTable
CREATE TABLE "shop_applications" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "status" "shop_application_status" NOT NULL DEFAULT 'PENDING',
    "applicant_name" VARCHAR(80) NOT NULL,
    "applicant_email" VARCHAR(254) NOT NULL,
    "applicant_phone" VARCHAR(20) NOT NULL,
    "business_name" VARCHAR(80) NOT NULL,
    "rc_number" VARCHAR(20),
    "address" VARCHAR(160) NOT NULL,
    "city" VARCHAR(60) NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "proposed_shop_name" VARCHAR(80) NOT NULL,
    "note" VARCHAR(500),
    "email_verified_at" TIMESTAMPTZ(3),
    "decided_at" TIMESTAMPTZ(3),
    "decided_by" VARCHAR(80),
    "reason" VARCHAR(300),
    "shop_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shop_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_application_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "type" "shop_application_document_type" NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "object_key" VARCHAR(200) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_application_verifications" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_application_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_applications_reference_key" ON "shop_applications"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "shop_applications_shop_id_key" ON "shop_applications"("shop_id");

-- CreateIndex
CREATE INDEX "shop_applications_status_created_at_idx" ON "shop_applications"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "shop_applications_applicant_email_idx" ON "shop_applications"("applicant_email");

-- CreateIndex
CREATE UNIQUE INDEX "shop_application_documents_object_key_key" ON "shop_application_documents"("object_key");

-- CreateIndex
CREATE INDEX "shop_application_documents_application_id_uploaded_at_idx" ON "shop_application_documents"("application_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "shop_application_verifications_application_id_created_at_idx" ON "shop_application_verifications"("application_id", "created_at");

-- AddForeignKey
ALTER TABLE "shop_application_documents" ADD CONSTRAINT "shop_application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "shop_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_application_verifications" ADD CONSTRAINT "shop_application_verifications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "shop_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

