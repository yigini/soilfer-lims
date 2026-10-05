
                CREATE TABLE "Parent" ("id" TEXT PRIMARY KEY);
                CREATE TABLE "Project" (
                    "id" TEXT PRIMARY KEY,
                    "code" TEXT UNIQUE NOT NULL,
                    "name" TEXT NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
                    "parentRef" TEXT REFERENCES "Parent"("id")
                );
                INSERT INTO "Parent" ("id") VALUES ('valid-parent');
                INSERT INTO "Project" ("id", "code", "name", "status", "parentRef")
                VALUES ('p-1', 'PRJ-1', 'Project 1', 'ACTIVE', 'invalid-parent-fk');
            