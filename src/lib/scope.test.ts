import { describe, it, expect } from "vitest";
import { readScope, enforceReadScope } from "./scope";
import { DEFAULT_CREW_ID } from "./constants";

function req(headers?: Record<string, string>) {
  return new Request("http://localhost/api/x", { headers });
}

describe("readScope", () => {
  // T8-3: 헤더에서 현재 사용자 scope 추출 (architect §2.4)
  it("x-crew-id / x-role 헤더를 추출한다", () => {
    const s = readScope(req({ "x-crew-id": "crew-2", "x-role": "master" }));
    expect(s).toEqual({ crewId: "crew-2", role: "master" });
  });

  // 회귀 0: 헤더 부재 → 김민정 + crew (기존 API 테스트 무영향)
  it("헤더가 없으면 기본 crew + DEFAULT_CREW_ID 로 폴백한다", () => {
    const s = readScope(req());
    expect(s).toEqual({ crewId: DEFAULT_CREW_ID, role: "crew" });
  });
});

describe("enforceReadScope", () => {
  // AC-8: 멤버는 requested 를 무시하고 본인 강제
  it("멤버는 requested 를 무시하고 본인 crewId 를 강제한다", () => {
    const scope = { crewId: "crew-2", role: "crew" as const };
    expect(enforceReadScope(scope, "crew-3")).toBe("crew-2");
    expect(enforceReadScope(scope)).toBe("crew-2");
  });

  // 마스터는 requested 허용, 없으면 self
  it("마스터는 requested 를 허용하고, 없으면 self 를 사용한다", () => {
    const scope = { crewId: "master-1", role: "master" as const };
    expect(enforceReadScope(scope, "crew-3")).toBe("crew-3");
    expect(enforceReadScope(scope)).toBe("master-1");
  });
});
