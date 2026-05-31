import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { __resetStore, addRequest, getRecord } from "@/lib/store";

function post(body: unknown) {
  return new Request("http://localhost/api/attendance/requests/approve", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/attendance/requests/approve", () => {
  beforeEach(() => __resetStore());

  // AC-8: 유효 대기 요청 수락 → 200 {request, record}
  it("유효 대기 요청 수락 시 200 과 {request, record} 를 반환한다", async () => {
    const req = addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "연장", clockIn: "07:26", clockOut: "15:34" },
    });
    const res = await POST(post({ id: req.id }));
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
    const res = await POST(post({ id: "req-999" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeTruthy();
  });

  // id 누락 → 400
  it("id 누락 시 400 으로 거부한다", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
  });

  // E-2: 이미 수락된 요청 재수락 → 200 멱등 no-op
  it("이미 수락된 요청 재수락은 200 멱등 no-op(status 수락 유지)", async () => {
    const req = addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
    });
    await POST(post({ id: req.id }));
    const res2 = await POST(post({ id: req.id }));
    expect(res2.status).toBe(200);
    expect((await res2.json()).request.status).toBe("수락");
  });
});
