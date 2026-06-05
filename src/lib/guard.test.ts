import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, redirectMock, getUserWithActiveMembershipMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  getUserWithActiveMembershipMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/identity-repo", () => ({
  getUserWithActiveMembership: getUserWithActiveMembershipMock,
}));

import { requireMembership } from "./guard";

describe("requireMembership", () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockClear();
    getUserWithActiveMembershipMock.mockReset();
  });

  it("세션 user 검증과 활성 멤버십 조회를 단일 repository 호출로 처리한다", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getUserWithActiveMembershipMock.mockResolvedValue({
      userId: "user-1",
      membership: { id: "membership-1", role: "crew" },
    });

    await expect(requireMembership()).resolves.toEqual({
      userId: "user-1",
      membership: { id: "membership-1", role: "crew" },
    });
    expect(getUserWithActiveMembershipMock).toHaveBeenCalledTimes(1);
    expect(getUserWithActiveMembershipMock).toHaveBeenCalledWith("user-1");
  });

  it("DB에 user가 없으면 login으로 보낸다", async () => {
    authMock.mockResolvedValue({ user: { id: "ghost" } });
    getUserWithActiveMembershipMock.mockResolvedValue(null);

    await expect(requireMembership()).rejects.toThrow("redirect:/login");
  });

  it("user는 있지만 활성 멤버십이 없으면 onboarding으로 보낸다", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getUserWithActiveMembershipMock.mockResolvedValue({
      userId: "user-1",
      membership: null,
    });

    await expect(requireMembership()).rejects.toThrow("redirect:/onboarding");
  });
});
