-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "joinDate" TEXT,
ADD COLUMN     "workDays" TEXT,
ADD COLUMN     "workTime" TEXT;

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "clockIn" TEXT,
    "clockOut" TEXT,
    "breakMinutes" INTEGER NOT NULL DEFAULT 30,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "workMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "deductMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditRequest" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT '대기',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "off" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "substitute" BOOLEAN NOT NULL DEFAULT false,
    "approval" TEXT,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedShift" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "FixedShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "avatarInitial" TEXT NOT NULL DEFAULT '?',

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_storeId_idx" ON "AttendanceRecord"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_crewId_date_key" ON "AttendanceRecord"("crewId", "date");

-- CreateIndex
CREATE INDEX "EditRequest_storeId_idx" ON "EditRequest"("storeId");

-- CreateIndex
CREATE INDEX "EditRequest_crewId_idx" ON "EditRequest"("crewId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_storeId_idx" ON "ScheduleEntry"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_crewId_date_key" ON "ScheduleEntry"("crewId", "date");

-- CreateIndex
CREATE INDEX "FixedShift_storeId_idx" ON "FixedShift"("storeId");

-- CreateIndex
CREATE INDEX "FixedShift_crewId_idx" ON "FixedShift"("crewId");

-- CreateIndex
CREATE INDEX "Notification_crewId_idx" ON "Notification"("crewId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_crewId_key" ON "Profile"("crewId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditRequest" ADD CONSTRAINT "EditRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedShift" ADD CONSTRAINT "FixedShift_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
