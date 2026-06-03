-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "clockInStatus" TEXT NOT NULL DEFAULT '정상',
ADD COLUMN     "clockOutStatus" TEXT NOT NULL DEFAULT '정상';
