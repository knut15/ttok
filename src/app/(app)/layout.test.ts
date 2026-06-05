import { describe, expect, it, vi } from "vitest";

const { requireMembershipMock } = vi.hoisted(() => ({
  requireMembershipMock: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({ requireMembership: requireMembershipMock }));
vi.mock("@/components/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("@/components/GlobalHeader", () => ({ GlobalHeader: () => null }));
vi.mock("@/features/auth/components/AppAuthGate", () => ({
  AppAuthGate: ({ children }: { children: React.ReactNode }) => children,
}));

import AppLayout from "./layout";

describe("AppLayout", () => {
  it("보호 페이지 이동을 서버 DB 가드로 막지 않는다", async () => {
    const node = await AppLayout({ children: "content" });

    expect(requireMembershipMock).not.toHaveBeenCalled();
    expect(node).toBeTruthy();
  });
});
