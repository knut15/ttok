-- CreateIndex
CREATE INDEX "Membership_operationalId_idx" ON "Membership"("operationalId");

-- CreateIndex
CREATE INDEX "Membership_userId_active_idx" ON "Membership"("userId", "active");
