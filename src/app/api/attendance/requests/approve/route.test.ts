import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { addRequest, getRecord } from "@/lib/attendance-store";
import { resetDb } from "@/lib/db-seed";

function post(body: unknown, headers?: Record<string, string>) {
  return new Request("http://localhost/api/attendance/requests/approve", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const MASTER = { "x-role": "master" } as const;

describe("/api/attendance/requests/approve", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("유효 대기 요청 수락 시 200 과 {request, record} 를 반환한다", async () => {
    const req = await addRequest({
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
    expect((await getRecord("2026-05-04"))!.clockOut).toBe("15:34");
  });

  it("존재하지 않는 id 는 404 와 에러 JSON 을 반환한다", async () => {
    const res = await POST(post({ id: "req-999" }, MASTER));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeTruthy();
  });

  it("id 누락 시 400 으로 거부한다", async () => {
    const res = await POST(post({}, MASTER));
    expect(res.status).toBe(400);
  });

  it("이미 수락된 요청 재수락은 200 멱등 no-op(status 수락 유지)", async () => {
    const req = await addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "정상", clockIn: "08:00", clockOut: "15:00" },
    });
    await POST(post({ id: req.id }, MASTER));
    const res2 = await POST(post({ id: req.id }, MASTER));
    expect(res2.status).toBe(200);
    expect((await res2.json()).request.status).toBe("수락");
  });

  it("멤버 역할은 수락 시 403 을 반환하고 store 에 반영하지 않는다", async () => {
    const req = await addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "연장", clockIn: "07:26", clockOut: "15:34" },
    });
    const before = await getRecord("2026-05-04");
    const res = await POST(post({ id: req.id }, { "x-role": "crew" }));
    expect(res.status).toBe(403);
    expect(await getRecord("2026-05-04")).toEqual(before);
    expect((await getRecord("2026-05-04"))?.clockOut ?? null).not.toBe("15:34");
  });

  it("마스터 역할은 수락 시 200 으로 store 에 반영한다", async () => {
    const req = await addRequest({
      date: "2026-05-04",
      reason: "정정",
      after: { status: "연장", clockIn: "07:26", clockOut: "15:34" },
    });
    const res = await POST(post({ id: req.id }, { "x-role": "master" }));
    expect(res.status).toBe(200);
    expect((await res.json()).request.status).toBe("수락");
    expect((await getRecord("2026-05-04"))!.clockOut).toBe("15:34");
  });
});
