import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { resetDb } from "@/lib/db-seed";
import { MASTER_ID } from "@/lib/constants";

function post(headers?: Record<string, string>) {
  return new Request("http://localhost/api/invites", {
    method: "POST",
    headers,
  });
}

const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID } as const;

describe("POST /api/invites — 초대 생성 (T8-6 / AC-13 / AC-15)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  // AC-13: 마스터는 대기 상태의 초대 코드를 발급받는다 → 201 Invite
  it("마스터는 201 과 대기 상태의 초대 코드를 발급받는다", async () => {
    const res = await POST(post(MASTER));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBeTruthy();
    expect(body.status).toBe("대기");
    expect(body.createdBy).toBe(MASTER_ID);
  });

  // AC-15: 멤버는 초대 생성 불가 → 403
  it("멤버 역할은 초대 생성 시 403 을 반환한다", async () => {
    const res = await POST(post({ "x-role": "crew", "x-crew-id": "crew-2" }));
    expect(res.status).toBe(403);
  });

  // 헤더 부재(기본 멤버 폴백) → 403
  it("역할 헤더 부재 시 403 을 반환한다(기본 멤버 폴백)", async () => {
    const res = await POST(post());
    expect(res.status).toBe(403);
  });
});
