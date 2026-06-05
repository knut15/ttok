import { describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/features/attendance/components/HomeToday", () => ({
  HomeToday: () => null,
}));
vi.mock("@/features/auth/components/HomeRoleRedirect", () => ({
  HomeRoleRedirect: () => null,
}));

import HomePage from "./page";

describe("HomePage", () => {
  it("홈 shell 렌더링을 서버 auth 호출에 의존하지 않는다", async () => {
    const node = await HomePage();

    expect(authMock).not.toHaveBeenCalled();
    expect(node).toBeTruthy();
  });
});
