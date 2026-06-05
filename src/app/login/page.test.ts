import { describe, expect, it, vi } from "vitest";

const { authMock, userExistsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userExistsMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/identity-repo", () => ({ userExists: userExistsMock }));
vi.mock("@/features/auth/components/LoginPageClient", () => ({
  LoginPageClient: () => null,
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  it("공개 로그인 shell 렌더링을 서버 auth/DB 조회에 의존하지 않는다", async () => {
    const node = LoginPage();

    expect(authMock).not.toHaveBeenCalled();
    expect(userExistsMock).not.toHaveBeenCalled();
    expect(node).toBeTruthy();
  });
});
