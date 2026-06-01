import { describe, it, expect } from "vitest";
import {
  buildSeedRecords,
  buildSeedCrews,
  buildSeedRecordsByCrew,
  buildSeedInvites,
} from "./seed";
import { DEFAULT_CREW_ID, MASTER_ID } from "./constants";

// T8-1 (AC-1 / AC-2 / AC-3): 멀티멤버 시드 — 기존 김민정 시드 불변 + 신규 멤버.
describe("buildSeedCrews — 마스터1 + 멤버4 (AC-1, 신규입사자 포함)", () => {
  const crews = buildSeedCrews();

  it("마스터 1명 + 멤버 4명 = 총 5 계정이 존재한다", () => {
    expect(crews).toHaveLength(5);
    expect(crews.filter((c) => c.role === "master")).toHaveLength(1);
    expect(crews.filter((c) => c.role === "crew")).toHaveLength(4);
  });

  it("마스터 id=MASTER_ID, 김민정 crew=DEFAULT_CREW_ID 가 포함된다", () => {
    expect(crews.some((c) => c.id === MASTER_ID && c.role === "master")).toBe(true);
    const minjung = crews.find((c) => c.id === DEFAULT_CREW_ID);
    expect(minjung).toBeDefined();
    expect(minjung!.role).toBe("crew");
    expect(minjung!.name).toBe("김민정");
    expect(minjung!.active).toBe(true);
  });
});

describe("buildSeedRecordsByCrew — 멤버별 records Map (AC-2 / AC-3)", () => {
  const byCrew = buildSeedRecordsByCrew();

  it("김민정(DEFAULT_CREW_ID)의 records 는 기존 buildSeedRecords() 와 바이트 동일하다 (AC-2)", () => {
    const minjungMap = byCrew.get(DEFAULT_CREW_ID)!;
    const expected = buildSeedRecords();
    expect(minjungMap.size).toBe(expected.length);
    for (const r of expected) {
      expect(minjungMap.get(r.date)).toEqual(r);
    }
  });

  it("멤버2/멤버3 도 records Map 을 가진다 (AC-3: 0건 이상, 본인 격리)", () => {
    expect(byCrew.has("crew-2")).toBe(true);
    expect(byCrew.has("crew-3")).toBe(true);
  });

  it("멤버2 의 5월 데이터는 김민정과 다르다 (본인 격리, AC-3)", () => {
    const minjung = [...byCrew.get(DEFAULT_CREW_ID)!.values()];
    const crew2 = [...byCrew.get("crew-2")!.values()];
    // 같은 날짜에 동일한 레코드 집합이면 안 됨(물리 분리 + 다른 mock 데이터)
    expect(JSON.stringify(crew2)).not.toBe(JSON.stringify(minjung));
  });
});

describe("buildSeedInvites — 초대 시드 (mock)", () => {
  it("초대 배열을 반환한다(빈 배열 허용)", () => {
    expect(Array.isArray(buildSeedInvites())).toBe(true);
  });
});
