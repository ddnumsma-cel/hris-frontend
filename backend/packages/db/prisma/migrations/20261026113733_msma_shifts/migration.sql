-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "breakStart" TEXT,
ADD COLUMN     "flexible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiredMinutes" INTEGER,
ADD COLUMN     "saturdayEnd" TEXT;

-- MSMA's standard shifts (8:30 AM start, lunch 12:00-1:00 PM, 5-minute grace):
--   Fixed shift 8:30-5:30 Mon-Fri · Busy season 8:30-5:00 Mon-Sat · Flex shift: in from 8:30, done by 7:30 PM, 8 hours, Mon-Fri
INSERT INTO "Shift" (id, code, name, "startTime", "endTime", "breakMinutes", "graceMinutes", "workDays", "breakStart", flexible, "requiredMinutes", active) VALUES
  (gen_random_uuid()::text, 'FIXED', 'Fixed shift', '08:30', '17:30', 60, 5, ARRAY[1,2,3,4,5],   '12:00', false, NULL, true),
  (gen_random_uuid()::text, 'BUSY',  'Busy season', '08:30', '17:00', 60, 5, ARRAY[1,2,3,4,5,6], '12:00', false, NULL, true),
  (gen_random_uuid()::text, 'FLEX',  'Flex shift',  '08:30', '19:30', 60, 0, ARRAY[1,2,3,4,5],   '12:00', true,  480,  true)
ON CONFLICT (code) DO NOTHING;
