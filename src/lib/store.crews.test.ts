import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetStore,
  getMonthRecords,
  getProfile,
  listCrews,
  getCrewSummaries,
  createInvite,
  joinByInvite,
  isMaster,
} from "./store";
import { buildSeedRecords } from "./seed";
import { DEFAULT_CREW_ID, MASTER_ID, SEED_MONTH } from "./constants";

beforeEach(() => {
  __resetStore();
});

describe("getMonthRecords — crewId 스코프 (AC-2 / AC-3 / AC-R2)", () => {
  it("인자 생략 시 김민정(DEFAULT_CREW_ID) 데이터를 반환한다 (회귀, AC-R2)", () => {
    const records = getMonthRecords(SEED_MONTH);
    const expected = buildSeedRecords();
    expect(records).toHaveLength(expected.length);
    // 기존 시드와 동일 날짜 집합
    expect(records.map((r) => r.date)).toEqual(expected.map((r) => r.date).sort());
  });

  it("crewId='crew-2' 지정 시 멤버2 데이터를 반환한다 (AC-3)", () => {
    const records = getMonthRecords(SEED_MONTH, "crew-2");
    expect(records.length).toBeGreaterThan(0);
    // 김민정과 다른 데이터(본인 격리)
    const minjung = getMonthRecords(SEED_MONTH, DEFAULT_CREW_ID);
    expect(JSON.stringify(records)).not.toBe(JSON.stringify(minjung));
  });

  it("등록되지 않은 crewId 는 빈 배열을 반환한다 (NaN/crash 방어, E-5)", () => {
    expect(getMonthRecords(SEED_MONTH, "crew-nonexistent")).toEqual([]);
  });
});

describe("getProfile — crewId 스코프 (AC-R2)", () => {
  it("인자 생략 시 김민정 프로필을 반환한다 (회귀)", () => {
    expect(getProfile().profile.name).toBe("김민정");
  });
});

describe("listCrews — mock 계정 목록 (AC-1)", () => {
  it("마스터 1 + 멤버 4 = 5 계정을 반환한다", () => {
    const crews = listCrews();
    expect(crews).toHaveLength(5);
    expect(crews.some((c) => c.id === MASTER_ID && c.role === "master")).toBe(true);
    expect(crews.some((c) => c.id === DEFAULT_CREW_ID && c.role === "crew")).toBe(true);
  });
});

describe("getCrewSummaries — 마스터 집계 (AC-10 / AC-11)", () => {
  it("멤버 4명의 근무/연장/휴가 요약을 반환한다(마스터 제외)", () => {
    const summaries = getCrewSummaries(SEED_MONTH);
    expect(summaries).toHaveLength(4);
    // 마스터는 집계 대상이 아니다
    expect(summaries.some((s) => s.crewId === MASTER_ID)).toBe(false);
    const minjung = summaries.find((s) => s.crewId === DEFAULT_CREW_ID)!;
    expect(minjung.name).toBe("김민정");
    // 김민정 5월 근무시간 합계 > 0
    expect(minjung.workMinutes).toBeGreaterThan(0);
  });

  it("멤버2 의 휴가일 수를 정확히 집계한다(휴가 1건)", () => {
    const crew2 = getCrewSummaries(SEED_MONTH).find((s) => s.crewId === "crew-2")!;
    expect(crew2.vacationDays).toBe(1);
  });

  it("데이터 없는 월은 0 집계(NaN 방어, E-5/E-6)", () => {
    const summaries = getCrewSummaries("2099-01");
    for (const s of summaries) {
      expect(s.workMinutes).toBe(0);
      expect(s.overtimeMinutes).toBe(0);
      expect(s.vacationDays).toBe(0);
    }
  });
});

describe("createInvite / joinByInvite — 초대 플로우 (AC-13 / AC-14 / E-2 / E-2b)", () => {
  it("createInvite 는 대기 상태의 고유 코드를 발급한다 (AC-13)", () => {
    const invite = createInvite(MASTER_ID);
    expect(invite.code).toBeTruthy();
    expect(invite.status).toBe("대기");
    expect(invite.createdBy).toBe(MASTER_ID);
  });

  it("joinByInvite 유효 미사용 코드 → 멤버 active=true, 코드 사용됨 (AC-14)", () => {
    const invite = createInvite(MASTER_ID);
    const result = joinByInvite(invite.code, "crew-2");
    expect(result).not.toBeNull();
    expect(result).not.toBe("used");
    if (result === null || result === "used") throw new Error("unexpected");
    expect(result.ok).toBe(true);
    expect(result.crew.id).toBe("crew-2");
    expect(result.crew.active).toBe(true);
  });

  it("없는 코드로 합류 시도 → null (E-2)", () => {
    expect(joinByInvite("NOPE99", "crew-2")).toBeNull();
  });

  it("이미 사용된 코드 재사용 → 'used' 거부 신호 (E-2b, 409 의미)", () => {
    const invite = createInvite(MASTER_ID);
    joinByInvite(invite.code, "crew-2");
    expect(joinByInvite(invite.code, "crew-3")).toBe("used");
  });
});

describe("isMaster — 역할 판정", () => {
  it("MASTER_ID 는 마스터다", () => {
    expect(isMaster(MASTER_ID)).toBe(true);
  });
  it("멤버 id 는 마스터가 아니다", () => {
    expect(isMaster(DEFAULT_CREW_ID)).toBe(false);
  });
  it("없는 id 는 마스터가 아니다", () => {
    expect(isMaster("ghost")).toBe(false);
  });
});

// dev HMR 잔존 store 형태 가드 — T8 store 스키마 변경 후 옛 store(globalThis)가 살아남아
// recordsByCrew 가 undefined 이면 전 API 500 나던 버그. getStore 가드가 자동 재생성해야 한다.
describe("getStore 형태 가드 (HMR stale store 자동 재생성)", () => {
  it("옛 형태(records Map만, recordsByCrew 부재) 주입 시 getMonthRecords 가 throw 없이 재생성·동작", () => {
    // T8 이전 형태를 globalThis 에 강제 주입(HMR 잔존 시뮬레이션).
    (globalThis as unknown as { __crewmonStore: unknown }).__crewmonStore = {
      records: new Map(),
      requests: [],
      seq: 1,
    };
    // 가드가 형태 불일치를 감지하고 createStore() 로 재생성 → 김민정 시드 반환.
    const recs = getMonthRecords(SEED_MONTH);
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });

  it("프로필 접근도 옛 형태에서 재생성되어 동작(profilesByCrew 부재 방어)", () => {
    (globalThis as unknown as { __crewmonStore: unknown }).__crewmonStore = {
      records: new Map(),
      requests: [],
      seq: 1,
    };
    const { profile } = getProfile();
    expect(profile.name).toBe("김민정");
  });
});
