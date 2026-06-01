import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { resetDb } from "@/lib/db-seed";

function post(body: unknown) {
  return new Request("http://localhost/api/attendance/requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const getReq = new Request("http://localhost/api/attendance/requests");

describe("/api/attendance/requests", () => {
  beforeEach(async () => {
    await resetDb();
  });

  // AC-9
  it("POST 로 요청을 저장하면 GET 이 status:대기 로 포함한다", async () => {
    const created = await POST(
      post({
        date: "2026-05-04",
        reason: "출근 시각 정정",
        after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.status).toBe("대기");
    expect(createdBody.date).toBe("2026-05-04");

    const list = await GET(getReq);
    const body = await list.json();
    expect(body.some((r: { id: string }) => r.id === createdBody.id)).toBe(true);
  });

  // 엣지#6: 빈 사유 → 400, 미생성
  it("빈 사유는 400 으로 거부한다", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "   ",
        after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
      }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });

  // P1-1 / E-8: after 형식 검증 (status 누락/불량, clock 형식 불량)
  it("after.status 누락(after:{}) 은 400 으로 거부하고 미생성", async () => {
    const res = await POST(
      post({ date: "2026-05-04", reason: "사유", after: {} }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });

  it("after.status 가 유효 WorkStatus 가 아니면 400 으로 거부", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "사유",
        after: { status: "이상값", clockIn: null, clockOut: null },
      }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });

  // v3 P1: clockIn/clockOut 필드 부재(undefined) → 400 (undefined != null 이 false 라 검증 스킵되던 결함)
  it("after.clockOut 필드 부재(after:{status:정상}) 는 400 으로 거부하고 미생성", async () => {
    const res = await POST(
      post({ date: "2026-05-04", reason: "사유", after: { status: "정상" } }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });

  it("after.clockIn 형식이 불량(99:99)이면 400 으로 거부", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "사유",
        after: { status: "연장", clockIn: "99:99", clockOut: null },
      }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });

  // T7 E-2: after.breakStart/breakEnd 형식 불량(NaN) → 400, 미생성
  it("after.breakStart 형식이 불량(99:99)이면 400 으로 거부하고 미생성", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "휴게 정정",
        after: {
          status: "정상",
          clockIn: "08:00",
          clockOut: "15:00",
          breakStart: "99:99",
          breakEnd: "12:00",
        },
      }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });

  it("after.breakEnd 형식이 불량(bad)이면 400 으로 거부", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "휴게 정정",
        after: {
          status: "정상",
          clockIn: "08:00",
          clockOut: "15:00",
          breakStart: "11:30",
          breakEnd: "bad",
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  // P2-1 / architect §2.7: 둘 다 명시된 휴게 범위가 역전(end<start)이면 400, 미생성
  it("after.breakStart>breakEnd(12:00~11:30) 역전 범위는 400 으로 거부하고 미생성", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "휴게 정정",
        after: {
          status: "정상",
          clockIn: "08:00",
          clockOut: "15:00",
          breakStart: "12:00",
          breakEnd: "11:30",
        },
      }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });

  // P2-1 / architect §2.7: 동일(end===start)도 end<=start 라 400
  it("after.breakStart===breakEnd(11:30~11:30) 동일 범위는 400 으로 거부", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "휴게 정정",
        after: {
          status: "정상",
          clockIn: "08:00",
          clockOut: "15:00",
          breakStart: "11:30",
          breakEnd: "11:30",
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  // P2-1: 정상 범위(11:30~12:00, end>start)는 그대로 201 (기존 동작 유지)
  it("정상 휴게 범위(11:30~12:00) after 는 201 로 생성", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "휴게 정정",
        after: {
          status: "정상",
          clockIn: "08:00",
          clockOut: "15:00",
          breakStart: "11:30",
          breakEnd: "12:00",
        },
      }),
    );
    expect(res.status).toBe(201);
  });

  // T7: 유효 휴게 범위(11:30~13:00) 는 201 로 생성
  it("유효 휴게 범위(11:30~13:00) after 는 201 로 생성", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "휴게 정정",
        after: {
          status: "정상",
          clockIn: "08:00",
          clockOut: "15:00",
          breakStart: "11:30",
          breakEnd: "13:00",
        },
      }),
    );
    expect(res.status).toBe(201);
  });

  it("정상 after({status:연장, clockIn:08:00, clockOut:16:30}) 는 201 로 생성", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "연장 정정",
        after: { status: "연장", clockIn: "08:00", clockOut: "16:30" },
      }),
    );
    expect(res.status).toBe(201);
    expect((await (await GET(getReq)).json()).length).toBe(1);
  });

  // === T15 과거 누락 근무기록 추가 ===

  // Q5(AC-11): clockIn·clockOut 둘 다 있고 clockOut<=clockIn 역전 → 400, 미생성
  it("출근 09:00·퇴근 08:00 역전 추가요청은 400 으로 거부하고 미생성", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "출근 누락 보정",
        after: { status: "정상", clockIn: "09:00", clockOut: "08:00" },
      }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });

  // Q5 동일(end===start)도 clockOut<=clockIn 이라 400
  it("출근·퇴근 동일(09:00~09:00)은 400 으로 거부", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "보정",
        after: { status: "정상", clockIn: "09:00", clockOut: "09:00" },
      }),
    );
    expect(res.status).toBe(400);
  });

  // AC-4: 정상 추가(출근+퇴근, clockOut>clockIn) → 201 대기 생성
  it("정상 추가요청(출근 08:00·퇴근 15:00)은 201 대기로 생성한다", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "출근 미입력 누락 보정",
        after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).status).toBe("대기");
  });

  // E-6/Q2: 출근만(clockOut null) 추가는 역전 가드 미진입 → 201 (clockOut-null 허용, 회귀0)
  it("출근만(퇴근 null) 추가요청은 201 로 생성한다(역전 가드 미진입)", async () => {
    const res = await POST(
      post({
        date: "2026-05-04",
        reason: "출근만 보정",
        after: { status: "정상", clockIn: "08:00", clockOut: null },
      }),
    );
    expect(res.status).toBe(201);
  });

  // Q3/E-2: 미래 날짜 추가요청은 서버 방어 400, 미생성 (과거 누락 보정 한정)
  it("미래 날짜(9999-12-31) 추가요청은 400 으로 거부하고 미생성", async () => {
    const res = await POST(
      post({
        date: "9999-12-31",
        reason: "미래 사전 등록",
        after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
      }),
    );
    expect(res.status).toBe(400);
    expect((await (await GET(getReq)).json()).length).toBe(0);
  });
});
