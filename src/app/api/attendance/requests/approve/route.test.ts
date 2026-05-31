import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { __resetStore, addRequest, getRecord } from "@/lib/store";

function post(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/attendance/requests/approve", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// T8-7: 수락은 마스터 전용 액션(AC-18/19). 검증 경로 테스트는 마스터 헤더로 게이트 통과.
const MASTER = { "x-role": "master" } as const;

describe("/api/attendance/requests/approve", () => {
  beforeEach(() => __resetStore());

  // AC-8: 유효 대기 요청 수락 → 200 {request, record}
  it("유효 대기 요청 수락 시 200 과 {request, record} 를 반환한다", async () => {
    const req = addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "연장", clockIn: "07:26", clockOut: "15:34" },
    });
    const res = await POST(post({ id: req.id }, MASTER));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe("수락");
    expect(body.record.clockOut).toBe("15:34");
    expect(body.record.overtimeMinutes).toBe(34);
    // store 진실원 반영
    expect(getRecord("2026-05-04")!.clockOut).toBe("15:34");
  });

  // E-1: 없는 id → 404
  it("존재하지 않는 id 는 404 와 에러 JSON 을 반환한다", async () => {
    const res = await POST(post({ id: "req-999" }, MASTER));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeTruthy();
  });

  // id 누락 → 400
  it("id 누락 시 400 으로 거부한다", async () => {
    const res = await POST(post({}, MASTER));
    expect(res.status).toBe(400);
  });

  // E-2: 이미 수락된 요청 재수락 → 200 멱등 no-op
  it("이미 수락된 요청 재수락은 200 멱등 no-op(status 수락 유지)", async () => {
    const req = addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
    });
    await POST(post({ id: req.id }, MASTER));
    const res2 = await POST(post({ id: req.id }, MASTER));
    expect(res2.status).toBe(200);
    expect((await res2.json()).request.status).toBe("수락");
  });

  // T8-7 / AC-18: 크루(x-role:crew)는 수락 불가 → 403 + store 불변
  it("크루 역할은 수락 시 403 을 반환하고 store 에 반영하지 않는다", async () => {
    const req = addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "연장", clockIn: "07:26", clockOut: "15:34" },
    });
    const before = getRecord("2026-05-04");
    const res = await POST(post({ id: req.id }, { "x-role": "crew" }));
    expect(res.status).toBe(403);
    // store 불변: 레코드 변경 없음 + 요청은 여전히 대기
    expect(getRecord("2026-05-04")).toEqual(before);
    expect(getRecord("2026-05-04")?.clockOut ?? null).not.toBe("15:34");
  });

  // T8-7 / AC-19: 마스터(x-role:master)는 기존 동작대로 200 반영
  it("마스터 역할은 수락 시 200 으로 store 에 반영한다", async () => {
    const req = addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "연장", clockIn: "07:26", clockOut: "15:34" },
    });
    const res = await POST(post({ id: req.id }, { "x-role": "master" }));
    expect(res.status).toBe(200);
    expect((await res.json()).request.status).toBe("수락");
    expect(getRecord("2026-05-04")!.clockOut).toBe("15:34");
  });
});
