import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
const { findActiveMembership, createStoreWithMaster } = vi.hoisted(() => ({
  findActiveMembership: vi.fn(),
  createStoreWithMaster: vi.fn(),
}));
vi.mock("@/lib/guard", () => ({ getSessionUser }));
vi.mock("@/lib/identity-repo", () => ({ findActiveMembership, createStoreWithMaster }));

import { POST } from "./route";

function post(body: unknown) {
  return new Request("http://localhost/api/onboarding/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/onboarding/store", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    getSessionUser.mockResolvedValue({ id: "u1" });
    findActiveMembership.mockReset();
    findActiveMembership.mockResolvedValue(null);
    createStoreWithMaster.mockReset();
    createStoreWithMaster.mockResolvedValue({ store: { id: "s1" }, membership: { id: "m1" } });
  });

  it("미로그인 → 401", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await POST(post({ storeName: "카페", bizNumber: "123" }));
    expect(res.status).toBe(401);
  });

  it("이미 멤버십 보유 → 409", async () => {
    findActiveMembership.mockResolvedValue({ id: "exists" });
    const res = await POST(post({ storeName: "카페", bizNumber: "123" }));
    expect(res.status).toBe(409);
  });

  it("매장명/사업자번호 누락 → 400", async () => {
    expect((await POST(post({ storeName: "", bizNumber: "123" }))).status).toBe(400);
    expect((await POST(post({ storeName: "카페", bizNumber: "" }))).status).toBe(400);
  });

  it("loc/dev(BIZ_VALIDATION=off): 아무 사업자번호나 201", async () => {
    const res = await POST(post({ storeName: "테스트 카페", bizNumber: "아무번호" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, storeId: "s1" });
  });

  it("사업자번호 중복 → 409", async () => {
    createStoreWithMaster.mockResolvedValue("duplicate-biz");
    const res = await POST(post({ storeName: "카페", bizNumber: "2208162517" }));
    expect(res.status).toBe(409);
  });
});
