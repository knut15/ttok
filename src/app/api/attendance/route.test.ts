import { describe, it, expect, beforeEach } from "vitest";
import { GET, PATCH } from "./route";
import { resetDb } from "@/lib/db-seed";

function req(url: string, init?: RequestInit) {
  return new Request(`http://localhost${url}`, init);
}

describe("GET /api/attendance", () => {
  beforeEach(async () => {
    await resetDb();
  });

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

  // REWORK v2 / P1-2 / AC-11: 마스터 드릴다운 — ?crewId=대상 + master 헤더 →
  // 대상 멤버(crew-2)의 본인 근무기록을 반환한다(김민정 격리, enforceReadScope 마스터 허용).
  it("마스터는 ?crewId 로 대상 멤버(crew-2)의 근무기록을 조회한다", async () => {
    const res = await GET(
      req("/api/attendance?month=2026-05&crewId=crew-2", {
        headers: { "x-role": "master", "x-crew-id": "master-1" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { date: string }[];
    // crew-2 시드는 2026-05-09(지각)를 가지나 김민정(기본 스코프)에는 없다 → 격리 확인.
    expect(body.some((r) => r.date === "2026-05-09")).toBe(true);
    const minjung = await GET(req("/api/attendance?month=2026-05"));
    const minjungBody = (await minjung.json()) as { date: string }[];
    expect(minjungBody.some((r) => r.date === "2026-05-09")).toBe(false);
  });

  // P1-2 권한 경계: 멤버는 ?crewId 를 무시하고 본인 데이터만(enforceReadScope) → 드릴다운 불가.
  it("멤버는 ?crewId 를 무시하고 본인(김민정) 데이터만 조회한다", async () => {
    const res = await GET(
      req("/api/attendance?month=2026-05&crewId=crew-2", {
        headers: { "x-role": "crew", "x-crew-id": "crew-minjung" },
      }),
    );
    const body = (await res.json()) as { date: string }[];
    expect(body.some((r) => r.date === "2026-05-09")).toBe(false);
  });
});

describe("PATCH /api/attendance", () => {
  beforeEach(async () => {
    await resetDb();
  });

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

  // REWORK v3 #4: clock time 유효성 검증 (parseHHMM)
  it("clockIn 의 time 이 잘못된 형식('99:99')이면 400", async () => {
    const res = await PATCH(
      req("/api/attendance?date=2026-06-02", {
        method: "PATCH",
        body: JSON.stringify({ field: "clockIn", time: "99:99" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("clockIn 의 time 이 유효('09:00')하면 200", async () => {
    const res = await PATCH(
      req("/api/attendance?date=2026-06-02", {
        method: "PATCH",
        body: JSON.stringify({ field: "clockIn", time: "09:00" }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).clockIn).toBe("09:00");
  });

  // FR-1 / AC-1 / AC-4: 멤버별 출근 격리. 멤버A(crew-2) 출근 토글(x-crew-id 헤더)이
  // crew-2 레코드에만 기록되고, 멤버B(crew-3) GET 에는 반영되지 않는다(누수 0).
  it("멤버A 출근 토글은 본인(crew-2) 레코드에만 기록되고 멤버B(crew-3)에는 미반영된다", async () => {
    // 멤버A(crew-2) 출근
    const patched = await PATCH(
      req("/api/attendance?date=2026-06-01", {
        method: "PATCH",
        headers: { "x-role": "crew", "x-crew-id": "crew-2" },
        body: JSON.stringify({ field: "clockIn", time: "09:00" }),
      }),
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).clockIn).toBe("09:00");

    // 멤버A(crew-2) GET 에는 반영
    const gotA = await GET(
      req("/api/attendance?month=2026-06", {
        headers: { "x-role": "crew", "x-crew-id": "crew-2" },
      }),
    );
    const bodyA = (await gotA.json()) as { date: string; clockIn: string }[];
    expect(bodyA.find((r) => r.date === "2026-06-01")?.clockIn).toBe("09:00");

    // 멤버B(crew-3) GET 에는 미반영(격리)
    const gotB = await GET(
      req("/api/attendance?month=2026-06", {
        headers: { "x-role": "crew", "x-crew-id": "crew-3" },
      }),
    );
    const bodyB = (await gotB.json()) as { date: string }[];
    expect(bodyB.some((r) => r.date === "2026-06-01")).toBe(false);

    // 헤더 부재(기본 김민정 폴백) GET 에도 미반영 — 폴백 보존 회귀 확인
    const gotDefault = await GET(req("/api/attendance?month=2026-06"));
    const bodyDefault = (await gotDefault.json()) as { date: string }[];
    expect(bodyDefault.some((r) => r.date === "2026-06-01")).toBe(false);
  });
});
