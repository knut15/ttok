// 현재 사용자 scope 추출 + 읽기 권한 강제 (architect §2.4). 순수 헬퍼 — store 비의존.
// 전달방식: 헤더 x-crew-id / x-role (Q-D, URL 불변 → 회귀 0).
import type { Role } from "@/types";
import { DEFAULT_CREW_ID, HEADER_CREW_ID, HEADER_ROLE } from "./constants";

export interface Scope {
  crewId: string;
  role: Role;
}

/**
 * 요청 헤더에서 현재 사용자 scope 추출.
 * 회귀 0: 헤더 부재 → role="crew", crewId=DEFAULT_CREW_ID(김민정).
 */
export function readScope(req: Request): Scope {
  const role = (req.headers.get(HEADER_ROLE) as Role | null) ?? "crew";
  const crewId = req.headers.get(HEADER_CREW_ID) ?? DEFAULT_CREW_ID;
  return { role, crewId };
}

/**
 * 읽기 대상 crewId 결정(Q-C: 본인 데이터 강제 스코프).
 * - 크루: requested 무시, 본인(self) 강제(타인 노출 0, AC-8).
 * - 마스터: requested 허용, 없으면 self.
 */
export function enforceReadScope(scope: Scope, requested?: string): string {
  return scope.role === "master" ? (requested ?? scope.crewId) : scope.crewId;
}
