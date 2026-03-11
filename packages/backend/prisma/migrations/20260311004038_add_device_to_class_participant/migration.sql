-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_class_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "device_id" TEXT,
    "default_company_override" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "class_participants_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "class_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "class_participants_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_class_participants" ("class_id", "created_at", "default_company_override", "id", "participant_id") SELECT "class_id", "created_at", "default_company_override", "id", "participant_id" FROM "class_participants";
DROP TABLE "class_participants";
ALTER TABLE "new_class_participants" RENAME TO "class_participants";
CREATE UNIQUE INDEX "class_participants_class_id_participant_id_key" ON "class_participants"("class_id", "participant_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
