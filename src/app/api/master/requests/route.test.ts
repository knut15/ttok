import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { __resetStore, addRequest } from "@/lib/store";
import { MASTER_ID } from "@/lib/constants";
import type { MasterRequestsResponse } from "@/types";

function get(headers?: Record<string, string>) {
  return new Request("http://localhost/api/master/requests", { headers });
}

const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID } as const;

describe("GET /api/master/requests — 마스터 수정요청 조회 (FR-2)", () => {
  beforeEach(() => __resetStore());

  // AC-5/AC-6: 마스터는 전체 멤버 요청을 200·최신순·멤버명 매핑으로 받는다.
  it("마스터는 전체 멤버의 요청을 200·멤버명 포함으로 반환한다", async () => {
    addRequest({
      date: "2026-05-04",
      reason: "정정A",
      after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
      crewId: "crew-2",
    });
    addRequest({
      date: "2026-05-05",
      reason: "정정B",
      after: { status: "연장", clockIn: "08:00", clockOut: "15:34" },
      crewId: "crew-3",
    });

    const res = await GET(get(MASTER));
    expect(res.status).toBe(200);
    const body = (await res.json()) as MasterRequestsResponse;
    expect(body.requests).toHaveLength(2);
    // 두 멤버 요청이 모두 포함
    const crewIds = body.requests.map((r) => r.crewId);
    expect(crewIds).toContain("crew-2");
    expect(crewIds).toContain("crew-3");
    // 멤버명 매핑(서버 조인). crew-2 시드명이 존재
    const row2 = body.requests.find((r) => r.crewId === "crew-2")!;
    expect(row2.crewName).toBeTruthy();
    expect(row2.crewName).not.toBe("crew-2"); // 폴백(id) 아닌 실제 이름
  });

  // AC-8/AC-R3: 멤버는 403 + 목록 미노출.
  it("멤버 역할은 403 을 반환한다", async () => {
    const res = await GET(get({ "x-role": "crew", "x-crew-id": "crew-2" }));
    expect(res.status).toBe(403);
  });

  // 헤더 부재(기본 멤버 폴백) → 403.
  it("역할 헤더 부재 시 403 을 반환한다(기본 멤버 폴백)", async () => {
    const res = await GET(get());
    expect(res.status).toBe(403);
  });

  // E-2: 요청 0건이면 빈 배열을 200 으로 반환.
  it("요청이 0건이면 빈 배열을 200 으로 반환한다", async () => {
    const res = await GET(get(MASTER));
    expect(res.status).toBe(200);
    const body = (await res.json()) as MasterRequestsResponse;
    expect(body.requests).toEqual([]);
  });
});
