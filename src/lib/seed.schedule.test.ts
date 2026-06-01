import { describe, it, expect } from "vitest";
import { buildSeedSchedules } from "./seed";
import { getOperatingHours } from "./schedule";
import { parseHHMM } from "./time";

describe("6월 스케쥴 랜덤 채움 (운영시간 내 개별 시프트, 하루 최대 3인)", () => {
  const byDate = buildSeedSchedules();
  const juneDates = [...byDate.keys()].filter((d) => d.startsWith("2026-06"));

  it("6월 30일에 모두 배정된다", () => {
    expect(juneDates).toHaveLength(30);
  });

  it("하루 최대 3인까지만 배정된다", () => {
    for (const d of juneDates) {
      expect(byDate.get(d)!.length).toBeGreaterThanOrEqual(1);
      expect(byDate.get(d)!.length).toBeLessThanOrEqual(3);
    }
  });

  it("같은 날 동일 근무자 중복 배정이 없다", () => {
    for (const d of juneDates) {
      const ids = byDate.get(d)!.map((e) => e.crewId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("모든 시프트는 해당일 운영시간 범위 내다", () => {
    for (const d of juneDates) {
      const op = getOperatingHours(d);
      for (const e of byDate.get(d)!) {
        expect(parseHHMM(e.startTime)).toBeGreaterThanOrEqual(parseHHMM(op.open));
        expect(parseHHMM(e.endTime)).toBeLessThanOrEqual(parseHHMM(op.close));
        expect(parseHHMM(e.startTime)).toBeLessThan(parseHHMM(e.endTime));
      }
    }
  });

  it("신규입사자(crew-4)도 6월에 배정된다", () => {
    const all = juneDates.flatMap((d) => byDate.get(d)!);
    expect(all.some((e) => e.crewId === "crew-4")).toBe(true);
  });

  it("결정적 — 두 번 생성해도 동일하다", () => {
    expect(JSON.stringify([...buildSeedSchedules()])).toBe(
      JSON.stringify([...byDate]),
    );
  });
});
