import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { __resetStore } from "@/lib/store";

function post(body: unknown) {
  return new Request("http://localhost/api/attendance/requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const getReq = new Request("http://localhost/api/attendance/requests");

describe("/api/attendance/requests", () => {
  beforeEach(() => __resetStore());

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
});
