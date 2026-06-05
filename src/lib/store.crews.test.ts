import { describe, it, expect, beforeEach, vi } from "vitest";
import { getMonthRecords, getProfile, listStoreCrews } from "./store";
import { getStoreCrewSummaries } from "./master-summary";
import { resetDb } from "./db-seed";
import { buildSeedRecords } from "./seed";
import { DEFAULT_CREW_ID, MASTER_ID, SEED_MONTH } from "./constants";
import { prisma } from "./prisma";

let storeId: string;
beforeEach(async () => {
  storeId = await resetDb();
});

describe("getMonthRecords — crewId 스코프", () => {
  it("인자 생략 시 김민정(DEFAULT_CREW_ID) 데이터를 반환한다", async () => {
    const records = await getMonthRecords(SEED_MONTH);
    const expected = buildSeedRecords();
    expect(records).toHaveLength(expected.length);
    expect(records.map((r) => r.date)).toEqual(expected.map((r) => r.date).sort());
  });

  it("crewId='crew-2' 지정 시 멤버2 데이터를 반환한다", async () => {
    const records = await getMonthRecords(SEED_MONTH, "crew-2");
    expect(records.length).toBeGreaterThan(0);
    const minjung = await getMonthRecords(SEED_MONTH, DEFAULT_CREW_ID);
    expect(JSON.stringify(records)).not.toBe(JSON.stringify(minjung));
  });

  it("등록되지 않은 crewId 는 빈 배열을 반환한다", async () => {
    expect(await getMonthRecords(SEED_MONTH, "crew-nonexistent")).toEqual([]);
  });
});

describe("getProfile — crewId 스코프", () => {
  it("인자 생략 시 김민정 프로필을 반환한다", async () => {
    expect((await getProfile()).profile.name).toBe("김민정");
  });
});

describe("listStoreCrews — 매장 근무자 메타", () => {
  it("마스터 1 + 멤버 4 = 5 계정을 반환한다", async () => {
    const crews = await listStoreCrews(storeId);
    expect(crews).toHaveLength(5);
    expect(crews.some((c) => c.id === MASTER_ID && c.role === "master")).toBe(true);
    expect(crews.some((c) => c.id === DEFAULT_CREW_ID && c.role === "crew")).toBe(true);
  });
});

describe("getStoreCrewSummaries — 마스터 집계(Prisma)", () => {
  it("멤버 4명의 근무/연장/휴가 요약을 반환한다(마스터 제외)", async () => {
    const summaries = await getStoreCrewSummaries(storeId, SEED_MONTH);
    expect(summaries).toHaveLength(4);
    expect(summaries.some((s) => s.crewId === MASTER_ID)).toBe(false);
    const minjung = summaries.find((s) => s.crewId === DEFAULT_CREW_ID)!;
    expect(minjung.name).toBe("김민정");
    expect(minjung.workMinutes).toBeGreaterThan(0);
  });

  it("멤버2 의 휴가일 수를 정확히 집계한다(휴가 1건)", async () => {
    const crew2 = (await getStoreCrewSummaries(storeId, SEED_MONTH)).find((s) => s.crewId === "crew-2")!;
    expect(crew2.vacationDays).toBe(1);
  });

  it("데이터 없는 월은 0 집계", async () => {
    const summaries = await getStoreCrewSummaries(storeId, "2099-01");
    for (const s of summaries) {
      expect(s.workMinutes).toBe(0);
      expect(s.overtimeMinutes).toBe(0);
      expect(s.vacationDays).toBe(0);
    }
  });

  it("멤버 수와 무관하게 출퇴근 집계 쿼리를 한 번만 실행한다", async () => {
    const spy = vi.spyOn(prisma.attendanceRecord, "groupBy");
    const summaries = await getStoreCrewSummaries(storeId, SEED_MONTH);

    expect(summaries).toHaveLength(4);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
