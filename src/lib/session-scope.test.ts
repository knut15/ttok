import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_CREW_ID } from "./constants";

// @/auth 를 모킹 — 실제 NextAuth 초기화/요청컨텍스트 없이 두 분기 검증.
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));

import { resolveScope } from "./session-scope";

function req(headers?: Record<string, string>) {
  return new Request("http://localhost/api/x", { headers });
}

describe("resolveScope", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue(null); // 기본=비로그인. 각 테스트가 필요 시 override.
  });

  it("세션이 있으면 operationalId 를 crewId 로 매핑한다", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1" },
      role: "crew",
      storeId: "store-1",
      membershipId: "mem-1",
      operationalId: "crew-2",
      isManager: false,
    });
    const s = await resolveScope(req({ "x-crew-id": "crew-9", "x-role": "master" }));
    expect(s).toMatchObject({
      crewId: "crew-2", // 헤더(crew-9)가 아니라 세션 operationalId 우선
      role: "crew",
      userId: "user-1",
      storeId: "store-1",
      membershipId: "mem-1",
      isManager: false,
    });
  });

  it("operationalId 가 없으면(신규 실매장) userId 를 crewId 로 쓴다", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-2" },
      role: "master",
      storeId: "store-2",
      membershipId: "mem-2",
      operationalId: null,
      isManager: false,
    });
    const s = await resolveScope(req());
    expect(s.crewId).toBe("user-2");
    expect(s.role).toBe("master");
  });

  it("세션이 없으면 헤더 기반 readScope 로 폴백한다", async () => {
    authMock.mockResolvedValue(null);
    const s = await resolveScope(req({ "x-crew-id": "crew-3", "x-role": "master" }));
    expect(s).toEqual({ crewId: "crew-3", role: "master", isManager: false });
  });

  it("세션도 헤더도 없으면 기본 김민정/crew 로 폴백한다", async () => {
    authMock.mockResolvedValue(null);
    const s = await resolveScope(req());
    expect(s).toEqual({ crewId: DEFAULT_CREW_ID, role: "crew", isManager: false });
  });

  it("auth() 가 throw 해도(요청컨텍스트 밖) 폴백한다", async () => {
    authMock.mockImplementation(() => {
      throw new Error("outside request scope");
    });
    const s = await resolveScope(req({ "x-crew-id": "crew-2", "x-role": "crew" }));
    expect(s).toEqual({ crewId: "crew-2", role: "crew", isManager: false });
  });
});
