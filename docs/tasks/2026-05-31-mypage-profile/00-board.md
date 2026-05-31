# 📋 Task Board — Crewmon 마이페이지 + 프로필 수정 (T2)

> **운영 모드**: teammate / **스택**: Next.js 16 App Router (기존 repo 확장)
> **구조**: feature-based (캐시 재사용) / **참조**: IMG_3616(마이페이지), IMG_3618(프로필 수정)
> **선행 task**: `2026-05-31-crewmon-attendance-pay` (홈/출퇴근/급여, PASS 완료)

## 범위 (사용자 결정)
- **포함**: 마이페이지 탭(프로필 요약·나의 매장·문서함 카드·서비스 안내) + 프로필 수정 화면. 바텀탭 '마이페이지' 활성화.
- **제외**: 문서함 상세(급여명세서/근로계약서/기타문서 화면), 알림 목록, 실제 본인인증/로그인. (문서함 카드는 진입점 카운트만, 상세는 placeholder)

## 단계별 진행 상태
| # | Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|---|
| -1/-0.5 | config/구조 | orchestrator | ✅ 캐시 재사용 | `.task-orchestrator.yml` |
| 0 | Task 생성 | orchestrator | ✅ 완료 | `00-board.md` |
| 1 | 기획 | planner | ✅ 완료 | `01-prd.md` (AC 17, sub-task 5) |
| 2 | 승인 | approver | ✅ APPROVE | `02-approval.md` (7/8 + 쟁점 1/2/3 결정) |
| 2.5 | 아키텍처 | architect | ✅ 완료 | `03-architecture.md` (회귀방지 설계, 4/4 PASS) |
| 3 | 구현 | developer | ✅ 완료 | `04-implementation.md` (74 test, 회귀 0, 커밋 c4869f8) |
| 4 | 리뷰 | reviewer | ✅ PASS | `05-review.md` (AC 17/17, 회귀 0, codex 코드축 PASS) |

## 진행 로그
- 2026-05-31 — T2 시작, config/구조 캐시 재사용, Phase 1 기획 진입
- 2026-05-31 — PRD(AC17)→APPROVE(쟁점1/2/3)→아키텍처(회귀방지)→구현(74 test, 회귀0)→리뷰 PASS
- 2026-05-31 — ✅ T2 Done (rework_count=0, 1패스 통과)

---

# 🎉 Task 최종 결과 (오케스트레이터 보고) — T2

## 파이프라인 요약
| Phase | 결과 |
|---|---|
| -0.5/0 | ✅ config/구조 캐시 재사용, artifact 생성 |
| 1 기획 | ✅ PRD (AC 17, sub-task 5) |
| 2 승인 | ✅ AI 7/8 + APPROVE (쟁점 1/2/3 권고안 채택) |
| 2.5 아키텍처 | ✅ 4섹션, 회귀방지 설계, 정규식 4/4 |
| 3 구현 | ✅ 74 test (기존 56 회귀 0 + 신규 18), 커밋 c4869f8 |
| 4 리뷰 | ✅ PASS (AC 17/17, codex 코드축 PASS) — rework 0 |

## 코드 변경
- **신규**: `src/features/mypage/**`(domain+hook+컴포넌트 8), `src/app/mypage/{page,profile/page}.tsx`, `src/app/api/profile/{route,route.test}.ts`, `src/lib/store.profile.test.ts`, `docs/adr/0002-readonly-profile-fields.md`
- **append-only 확장**: `types/index.ts`, `lib/{store,seed,constants,date}.ts`, `components/BottomNav.tsx`(1줄)
- **커밋**: `c4869f8` (main)

## 측정 결과
- vitest 74/74 (기존 56 회귀 0) · tsc 0 · build OK(`/mypage`,`/mypage/profile` static, `/api/profile` dynamic) · lint 0

## 후속 task 후보 (codex triage)
- **⚠️ P1 (선행 T1 코드 버그)** `src/lib/store.ts:88-91` — `updateStatus` 결근 재적용 시 deductMinutes 리셋 → 급여차감 합산 오류. **별도 버그수정 task 권고.**
- **P2** `src/lib/seed.ts:59` — 5/28 workMinutes 390 vs 실계산 392 불일치(시드 데이터).
- **P2** `src/app/api/attendance/requests/route.ts:20` — 수정요청 after 내용 검증 미비.
- (T1 잔여) P2-F1 store else 분기 break 초기화, P2-F2 동일 requests 검증.
- (범위 밖) 문서함 상세·알림 목록·본인인증.

## 관련 산출물
- `docs/tasks/2026-05-31-mypage-profile/{01-prd,02-approval,03-architecture,04-implementation,05-review}.md`
- `CONTEXT.md`(profile 용어 추가), `docs/adr/0002-readonly-profile-fields.md`
