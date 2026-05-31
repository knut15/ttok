import { describe, it, expect, beforeEach } from "vitest";
import { GET, PATCH } from "./route";
import { __resetStore } from "@/lib/store";

function req(url: string, init?: RequestInit) {
  return new Request(`http://localhost${url}`, init);
}

describe("GET /api/attendance", () => {
  beforeEach(() => __resetStore());

  // AC-6
  it("월간 레코드 배열을 반환하고 각 레코드가 계약 필드를 가진다", async () => {
    const res = await GET(req("/api/attendance?month=2026-05"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    const r = body.find((x: { date: string }) => x.date === "2026-05-28");
    expect(r).toMatchObject({
      date: "2026-05-28",
      status: "정상",
      clockIn: expect.any(String),
      clockOut: expect.any(String),
      breakMinutes: expect.any(Number),
      workMinutes: expect.any(Number),
      overtimeMinutes: expect.any(Number),
    });
  });

  // 엣지#1: 빈 달
  it("시드 없는 달은 빈 배열을 반환한다", async () => {
    const res = await GET(req("/api/attendance?month=2026-04"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("PATCH /api/attendance", () => {
  beforeEach(() => __resetStore());

  // AC-8: status 변경 후 GET 시 반영
  it("status 를 연장으로 변경하면 응답과 직후 조회에 반영된다", async () => {
    const patched = await PATCH(
      req("/api/attendance?date=2026-05-28", {
        method: "PATCH",
        body: JSON.stringify({ status: "연장" }),
      }),
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).status).toBe("연장");

    const got = await GET(req("/api/attendance?month=2026-05"));
    const r = (await got.json()).find(
      (x: { date: string }) => x.date === "2026-05-28",
    );
    expect(r.status).toBe("연장");
  });

  it("존재하지 않는 날짜 변경은 404", async () => {
    const res = await PATCH(
      req("/api/attendance?date=2026-04-01", {
        method: "PATCH",
        body: JSON.stringify({ status: "연장" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  // 쟁점 C: 출/퇴근 토글로 주입한 시각이 기록되고 time.ts 로 workMinutes 재계산
  it("clockIn→clockOut 토글이 주입 시각을 기록하고 근무시간을 재계산한다", async () => {
    // 시드에 없는 '오늘' 날짜 → 기본 휴게 30분의 새 레코드 생성
    await PATCH(
      req("/api/attendance?date=2026-06-01", {
        method: "PATCH",
        body: JSON.stringify({ field: "clockIn", time: "08:00" }),
      }),
    );
    const out = await PATCH(
      req("/api/attendance?date=2026-06-01", {
        method: "PATCH",
        body: JSON.stringify({ field: "clockOut", time: "15:00" }),
      }),
    );
    const body = await out.json();
    expect(body.clockIn).toBe("08:00");
    expect(body.clockOut).toBe("15:00");
    expect(body.workMinutes).toBe(390); // 동일 time.ts 계산 경로
  });
});
