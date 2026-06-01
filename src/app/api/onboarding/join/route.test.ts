import { describe, it, expect, vi, beforeEach } from "vitest";

// guard(→@/auth) 와 repo(→prisma) 를 모킹 → next-auth/prisma 실제 로드 회피.
const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { joinByInviteCode } = vi.hoisted(() => ({ joinByInviteCode: vi.fn() }));
vi.mock("@/lib/guard", () => ({ getSessionUser }));
vi.mock("@/lib/identity-repo", () => ({ joinByInviteCode }));

import { POST } from "./route";

function post(body: unknown) {
  return new Request("http://localhost/api/onboarding/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/onboarding/join", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    getSessionUser.mockResolvedValue({ id: "u1" });
    joinByInviteCode.mockReset();
    joinByInviteCode.mockResolvedValue(null);
  });

  it("미로그인 → 401", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await POST(post({ code: "ABC123" }));
    expect(res.status).toBe(401);
  });

  it("코드 누락 → 400", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
  });

  it("없는 코드 → 400", async () => {
    joinByInviteCode.mockResolvedValue("invalid");
    const res = await POST(post({ code: "ZZZZZZ" }));
    expect(res.status).toBe(400);
  });

  it("이미 사용된 코드 → 409", async () => {
    joinByInviteCode.mockResolvedValue("used");
    const res = await POST(post({ code: "USED12" }));
    expect(res.status).toBe(409);
  });

  it("이미 멤버 → 409", async () => {
    joinByInviteCode.mockResolvedValue("already-member");
    const res = await POST(post({ code: "MEMBER" }));
    expect(res.status).toBe(409);
  });

  it("정상 합류 → 201 + storeId", async () => {
    joinByInviteCode.mockResolvedValue({ membership: { id: "m1" }, storeId: "s1" });
    const res = await POST(post({ code: "GOOD12" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, storeId: "s1", membershipId: "m1" });
  });
});
