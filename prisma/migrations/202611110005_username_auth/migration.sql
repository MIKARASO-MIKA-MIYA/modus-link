ALTER TABLE "User" ADD COLUMN "username" TEXT;
-- UUID fallback is unique even when existing emails share a local part.
UPDATE "User" SET "username" = replace("id"::text, '-', '');
WITH candidates AS (
 SELECT "id", lower(split_part("email", '@', 1)) AS candidate,
 row_number() OVER (PARTITION BY lower(split_part("email", '@', 1)) ORDER BY "createdAt", "id") AS rank
 FROM "User"
)
UPDATE "User" AS u SET "username" = c.candidate FROM candidates AS c
WHERE u."id" = c."id" AND c.rank = 1
 AND c.candidate ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'
 AND NOT EXISTS (SELECT 1 FROM "User" AS occupied WHERE occupied."username" = c.candidate AND occupied."id" <> u."id");
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "User" ADD CONSTRAINT "user_username_length" CHECK (length("username") BETWEEN 3 AND 32);