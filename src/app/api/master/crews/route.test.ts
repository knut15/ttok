import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { __resetStore } from "@/lib/store";
import { MASTER_ID, SEED_MONTH, DEFAULT_CREW_ID } from "@/lib/constants";

function get(month: string, headers?: Record<string, string>) {
  return new Request(`http://localhost/api/master/crews?month=${month}`, {
    headers,
  });
}

const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID } as const;

describe("GET /api/master/crews — 마스터 집계 (T8-5 / AC-10 / AC-11 / AC-12)", () => {
  beforeEach(() => __resetStore());

  // AC-10/AC-11: 마스터는 크루 3명의 월 집계를 받는다
  it("마스터는 200 과 MasterSummaryResponse(크루 3명 집계) 를 반환한다", async () => {
    const res = await GET(get(SEED_MONTH, MASTER));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.month).toBe(SEED_MONTH);
    expect(body.crews).toHaveLength(3);
    const minjung = body.crews.find(
      (c: { crewId: string }) => c.crewId === DEFAULT_CREW_ID,
    );
    expect(minjung.workMinutes).toBeGreaterThan(0);
    // 마스터는 집계 대상이 아니다
    expect(
      body.crews.some((c: { crewId: string }) => c.crewId === MASTER_ID),
    ).toBe(false);
  });

  // AC-12: 크루는 집계 조회 불가 → 403
  it("크루 역할은 집계 조회 시 403 을 반환한다", async () => {
    const res = await GET(get(SEED_MONTH, { "x-role": "crew", "x-crew-id": "crew-2" }));
    expect(res.status).toBe(403);
  });

  // 헤더 부재(기본 크루 폴백) → 403
  it("역할 헤더 부재 시 403 을 반환한다(기본 크루 폴백)", async () => {
    const res = await GET(get(SEED_MONTH));
    expect(res.status).toBe(403);
  });
});
