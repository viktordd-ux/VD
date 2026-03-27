-- AlterTable
ALTER TABLE "users" ADD COLUMN     "first_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "last_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "onboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "primary_skill" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "telegram" TEXT;

-- Существующие пользователи: ФИО из поля name, онбординг пройден, основной навык — первый из списка
UPDATE "users" SET
  first_name = split_part(name, ' ', 1),
  last_name = CASE
    WHEN position(' ' IN name) > 0 THEN trim(substring(name FROM position(' ' IN name) + 1))
    ELSE ''
  END,
  primary_skill = COALESCE(skills[1], ''),
  onboarded = true;
