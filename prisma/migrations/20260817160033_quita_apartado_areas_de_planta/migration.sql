/*
  Warnings:

  - You are about to drop the `plant_area_checklist_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plant_area_maintenance_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "plant_area_checklist_items";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "plant_area_maintenance_logs";
PRAGMA foreign_keys=on;
