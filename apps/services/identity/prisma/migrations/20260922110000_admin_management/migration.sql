-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "credentials_expire_at" TIMESTAMPTZ(3),
ADD COLUMN     "is_bootstrap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;
