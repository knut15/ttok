import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetStore,
  canWriteSchedule,
  getDaySchedules,
  getMonthSchedules,
  isManagerCrew,
  removeSchedule,
  setManager,
  upsertSchedule,
} from "./store";
import { DEFAULT_CREW_ID, MASTER_ID, SEED_MONTH } from "./constants";

beforeEach(() => {
  __resetStore();
});

describe("T16 매니저 권한 (isManager)", () => {
  it("시드에서 김민정은 매니저다", () => {
    expect(isManagerCrew(DEFAULT_CREW_ID)).toBe(true);
  });

  it("일반 크루는 매니저가 아니다", () => {
    expect(isManagerCrew("crew-2")).toBe(false);
  });

  it("setManager 로 지정/해제할 수 있다 (crew 역할만)", () => {
    expect(setManager("crew-2", true)).not.toBeNull();
    expect(isManagerCrew("crew-2")).toBe(true);
    setManager("crew-2", false);
    expect(isManagerCrew("crew-2")).toBe(false);
  });

  it("master 대상/없는 id 는 setManager 가 null (변경 안 함)", () => {
    expect(setManager(MASTER_ID, true)).toBeNull();
    expect(setManager("nope", true)).toBeNull();
  });
});

describe("T16 canWriteSchedule (서버 권한 판정)", () => {
  it("master 는 항상 작성권한", () => {
    expect(canWriteSchedule({ crewId: MASTER_ID, role: "master" })).toBe(true);
  });

  it("매니저 crew 는 작성권한", () => {
    expect(canWriteSchedule({ crewId: DEFAULT_CREW_ID, role: "crew" })).toBe(true);
  });

  it("일반 crew 는 작성권한 없음", () => {
    expect(canWriteSchedule({ crewId: "crew-2", role: "crew" })).toBe(false);
  });

  it("role=crew 면 헤더상 다른 권한이어도 store 플래그로만 판정", () => {
    // 비매니저가 role 만 crew 로 보냈을 때 권한 없음(스푸핑 방어 의도)
    expect(canWriteSchedule({ crewId: "crew-3", role: "crew" })).toBe(false);
  });
});

describe("T16 스케쥴 CRUD", () => {
  it("시드 월간 스케쥴이 date·crewId 순으로 정렬되어 반환된다", () => {
    const entries = getMonthSchedules(SEED_MONTH);
    expect(entries.length).toBeGreaterThan(0);
    const keys = entries.map((e) => `${e.date}/${e.crewId}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("빈 달은 빈 배열", () => {
    expect(getMonthSchedules("2099-01")).toEqual([]);
  });

  it("upsert: (date, crewId) 신규 생성", () => {
    const date = `${SEED_MONTH}-20`;
    const created = upsertSchedule({
      date,
      crewId: "crew-2",
      startTime: "10:00",
      endTime: "19:00",
      createdBy: MASTER_ID,
    });
    expect(created.id).toMatch(/^sch-/);
    expect(getDaySchedules(date)).toHaveLength(1);
  });

  it("upsert: 동일 (date, crewId) 는 id 보존하며 시간 갱신 (중복 생성 안 함)", () => {
    const date = `${SEED_MONTH}-20`;
    const a = upsertSchedule({ date, crewId: "crew-2", startTime: "10:00", endTime: "19:00", createdBy: MASTER_ID });
    const b = upsertSchedule({ date, crewId: "crew-2", startTime: "11:00", endTime: "20:00", createdBy: MASTER_ID });
    expect(b.id).toBe(a.id);
    expect(b.startTime).toBe("11:00");
    expect(getDaySchedules(date)).toHaveLength(1);
  });

  it("upsert: off 토글이 반영되고 해제 시 키가 제거된다", () => {
    const date = `${SEED_MONTH}-21`;
    const off = upsertSchedule({ date, crewId: "crew-3", startTime: "00:00", endTime: "00:00", off: true, createdBy: MASTER_ID });
    expect(off.off).toBe(true);
    const on = upsertSchedule({ date, crewId: "crew-3", startTime: "09:00", endTime: "18:00", createdBy: MASTER_ID });
    expect(on.off).toBeUndefined();
  });

  it("remove: id 로 삭제하고 빈 날짜 키는 정리된다", () => {
    const date = `${SEED_MONTH}-22`;
    const e = upsertSchedule({ date, crewId: "crew-2", startTime: "09:00", endTime: "18:00", createdBy: MASTER_ID });
    expect(removeSchedule(e.id)).toBe(true);
    expect(getDaySchedules(date)).toEqual([]);
    expect(removeSchedule(e.id)).toBe(false); // 이미 삭제됨
  });
});
