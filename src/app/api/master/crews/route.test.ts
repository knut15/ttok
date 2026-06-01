import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { resetDb } from "@/lib/db-seed";
import { MASTER_ID, SEED_MONTH, DEFAULT_CREW_ID } from "@/lib/constants";

function get(month: string, headers?: Record<string, string>) {
  return new Request(`http://localhost/api/master/crews?month=${month}`, {
    headers,
  });
}

const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID } as const;

describe("GET /api/master/crews — 마스터 집계 (T8-5 / AC-10 / AC-11 / AC-12)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  // AC-10/AC-11: 마스터는 멤버 4명의 월 집계를 받는다(신규입사자 포함)
  it("마스터는 200 과 MasterSummaryResponse(멤버 4명 집계) 를 반환한다", async () => {
    const res = await GET(get(SEED_MONTH, MASTER));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.month).toBe(SEED_MONTH);
    expect(body.crews).toHaveLength(4);
    const minjung = body.crews.find(
      (c: { crewId: string }) => c.crewId === DEFAULT_CREW_ID,
    );
    expect(minjung.workMinutes).toBeGreaterThan(0);
    // 마스터는 집계 대상이 아니다
    expect(
      body.crews.some((c: { crewId: string }) => c.crewId === MASTER_ID),
    ).toBe(false);
  });

  // AC-12: 멤버는 집계 조회 불가 → 403
  it("멤버 역할은 집계 조회 시 403 을 반환한다", async () => {
    const res = await GET(get(SEED_MONTH, { "x-role": "crew", "x-crew-id": "crew-2" }));
    expect(res.status).toBe(403);
  });

  // 헤더 부재(기본 멤버 폴백) → 403
  it("역할 헤더 부재 시 403 을 반환한다(기본 멤버 폴백)", async () => {
    const res = await GET(get(SEED_MONTH));
    expect(res.status).toBe(403);
  });
});
