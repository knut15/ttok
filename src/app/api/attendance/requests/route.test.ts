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
});
