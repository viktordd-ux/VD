-- CreateEnum
CREATE TYPE "FileEntryKind" AS ENUM ('file', 'link');

-- AlterTable
ALTER TABLE "files" ADD COLUMN "kind" "FileEntryKind" NOT NULL DEFAULT 'file';
ALTER TABLE "files" ADD COLUMN "external_url" TEXT;
ALTER TABLE "files" ADD COLUMN "link_title" TEXT;
ALTER TABLE "files" ALTER COLUMN "file_path" DROP NOT NULL;
