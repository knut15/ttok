import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/lib/db-seed";

// 테스트DB 하니스 스모크 — resetDb 가 데모 운영 데이터를 적재하는지.
describe("test-db harness", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("데모 운영 데이터가 시드된다", async () => {
    expect(await prisma.attendanceRecord.count()).toBeGreaterThan(0);
    expect(await prisma.scheduleEntry.count()).toBeGreaterThan(0);
    expect(await prisma.fixedShift.count()).toBe(3);
    const minjung = await prisma.attendanceRecord.findMany({ where: { crewId: "crew-minjung" } });
    expect(minjung.length).toBe(22);
  });

  it("reset 는 격리된다(이전 테스트가 넣은 행이 없다)", async () => {
    await prisma.notification.create({
      data: { storeId: (await prisma.store.findFirstOrThrow()).id, crewId: "crew-minjung", message: "x" },
    });
    await resetDb();
    expect(await prisma.notification.count()).toBe(0);
  });
});
