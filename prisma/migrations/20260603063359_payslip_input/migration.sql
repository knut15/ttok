-- CreateTable
CREATE TABLE "PayslipInput" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "incentiveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "monthlySales" INTEGER NOT NULL DEFAULT 0,
    "incomeTax" INTEGER NOT NULL DEFAULT 0,
    "nightPay" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayslipInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayslipInput_storeId_idx" ON "PayslipInput"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipInput_crewId_month_key" ON "PayslipInput"("crewId", "month");

-- AddForeignKey
ALTER TABLE "PayslipInput" ADD CONSTRAINT "PayslipInput_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
