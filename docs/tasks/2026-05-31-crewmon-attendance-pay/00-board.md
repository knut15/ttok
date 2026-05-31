# 📋 Task Board — Crewmon 출퇴근·급여 앱

> **운영 모드**: teammate (Notion 미사용, 로컬 markdown 산출물)
> **생성일**: 2026-05-31
> **스택**: Next.js 16 (App Router) + React 19 + Tailwind v4 / Route Handler + 인메모리
> **구조 패턴**: feature-based (사용자 컨펌)
> **참조 디자인**: `public/sample/IMG_3606~3619.png` (Crewmon 앱 14장)

## 범위 (사용자 결정)

- **포함**: 홈, 출퇴근(캘린더+근무기록 상세/수정+상태변경 모달), 급여(월 합계+일별 상세)
- **백엔드**: Next.js Route Handler + 인메모리 저장 (DB 없음)
- **제외(이번 범위 밖)**: 마이페이지, 문서함(급여명세서/근로계약서/기타문서), 알림, 프로필 수정, 인증

## 단계별 진행 상태

| # | Phase | 역할 | 상태 | 시작 | 완료 | 산출물 |
|---|---|---|---|---|---|---|
| -0.5 | 구조 분석 | structure-analyzer | ✅ 완료 | 2026-05-31 | 2026-05-31 | `.task-orchestrator.yml` |
| 0 | Task 생성 | orchestrator | ✅ 완료 | 2026-05-31 | 2026-05-31 | `00-board.md` |
| 1 | 기획 | planner | ✅ 완료 | 2026-05-31 | 2026-05-31 | `01-prd.md` (AC 20개, sub-task 7개) |
| 2 | 승인 | approver | ✅ APPROVE | 2026-05-31 | 2026-05-31 | `02-approval.md` (AI 7/8 + 쟁점 A/B/C 결정) |
| 2.5 | 아키텍처 | architect | ✅ 완료 | 2026-05-31 | 2026-05-31 | `03-architecture.md` (4섹션, 체크 6/6) |
| 3 | 구현 | developer | ✅ 완료 (v3) | 2026-05-31 | 2026-05-31 | `04-implementation.md` (56 test pass, 커밋 f74b9f4) |
| 4 | 리뷰 | reviewer | ✅ PASS | 2026-05-31 | 2026-05-31 | `05-review.md` (AC 20/20, codex 코드축 PASS) |

상태 범례: `미시작` → `진행중` → `완료` / `차단` / `건너뜀`

## 회의록

| # | 주제 | 단계 | 합의 | 파일 |
|---|---|---|---|---|
| — | (아직 없음) | — | — | `meetings/` |

## 진행 로그

- 2026-05-31 — Phase -1 config 로드 (schema_version 9), mode=teammate 오버라이드 적용
- 2026-05-31 — Phase -0.5 구조 분석: feature-based 패턴 사용자 컨펌, 캐시 저장
- 2026-05-31 — Phase 0 artifact 디렉토리 생성, 파이프라인 시작
- 2026-05-31 — Phase 1~2.5 PRD(AC20)→승인(쟁점 A/B/C)→아키텍처(4섹션)
- 2026-05-31 — Phase 3 구현(developer 1차 Overloaded 중단 → 오케스트레이터 DoD 검증 + CONTEXT/ADR 마감)
- 2026-05-31 — Phase 4 리뷰: REWORK A(codex 버그3) → v2 REWORK A(codex 신규4) → v3 PASS (rework_count=2)
- 2026-05-31 — ✅ Task Done

---

# 🎉 Task 최종 결과 (오케스트레이터 보고)

## 파이프라인 요약
| Phase | 결과 | 회차 |
|---|---|---|
| Phase -0.5 | ✅ 구조 분석 feature-based 컨펌 + 캐시 | — |
| Phase 0 | ✅ teammate artifact 디렉토리 + 보드 생성 | — |
| Phase 1 | ✅ PRD v1 (AC 20개, sub-task 7개) | — |
| Phase 2 | ✅ AI 1차 7/8 PASS + 사용자 APPROVE (쟁점 A/B/C 결정) | — |
| Phase 2.5 | ✅ 4섹션 설계서 (시드 불변식 리스크 사전 포착) | — |
| Phase 3 | ✅ 구현 (56 테스트 GREEN) | rework v3 (count=2) |
| Phase 4 | ✅ PASS (하네스축 AC20/20 AND codex 코드축 PASS) | rework v3 |

## 코드 변경 (검증된 정본)
- **신규**: `src/` 50개 TS/TSX 파일 (테스트 11개 포함), `CONTEXT.md`, `docs/adr/0001-in-memory-route-handler.md`
- **주요 구조**: `src/lib/{time,pay,date,seed,store,constants}.ts` · `src/types/index.ts` · `src/app/api/{attendance,pay}/**` (Route Handler 6종) · `src/components/` 공용 UI 7종 · `src/features/{attendance,pay}/**` · 페이지 5개(/、/attendance、/attendance/[date]、/pay、/pay/[date])
- **커밋**: `c653bc2`(도메인) → `89ae5b9`(앱+버그3) → `f74b9f4`(REWORK v3) — 모두 main

## 측정 비교 (PRD §3 메트릭)
| 지표 | 목표 | 결과 |
|---|---|---|
| 도메인 계산 테스트 | 100% pass | ✅ 56 passed (11 files) |
| 타입 안정성 | tsc 에러 0 | ✅ exit 0 |
| 빌드 | build 성공 | ✅ 11 라우트 컴파일 |
| Lint | 에러 0 | ✅ 0 problems |
| 핵심 라우트 | 6개 200 | ✅ 5 페이지 + api 동작 |
| 디자인 충실도 | AC-19 5/5 | ✅ 코랄테마·바텀탭4·라운드카드·바텀시트·모바일세로 |

## 자동 검증 결과 (Phase 4 최종)
- vitest 56 pass / tsc 0 / lint 0 / build OK
- Protected files: 없음 · 자동생성 파일 변경: 없음 · git working tree clean

## 후속 task 후보 (P2 — codex 잔여 비차단 지적)
- **P2-F1** `src/lib/store.ts:95-100` — else 분기 break 초기화: 상세에서 상태변경(정상) 후 홈 토글하는 비주류 2단계 경로에서 break=0 잔존 → 근무시간 과대산정 방지.
- **P2-F2** `src/app/api/attendance/requests/route.ts:20` — 수정요청 `after` 런타임 검증(향후 승인 플로우 추가 시 필요).
- (범위 밖, 차기 task 후보) 마이페이지·문서함(급여명세서/PDF)·알림 목록·프로필 수정·인증.

## 회의/회귀 통계
- 회의: facilitator 정식 회의는 teammate 단독 모드 효율화로 승인 게이트에 통합(0회). 사용자 결정 게이트 3회(범위/백엔드/모드/저장위치 → 구조 → 승인+쟁점 A/B/C).
- 자동 회귀(rework): 2회 (v2, v3), 전부 codex 코드축 FAIL이 트리거. 안전장치 미발동(hard_limit 3 미만, P1은 v3에서 0).
- 특이사항: developer 1차 실행이 API Overloaded로 중단 → 산출물은 완성 상태였고 오케스트레이터가 DoD 재검증·문서 마감.

## 관련 산출물 (레포 상대경로)
- 기획 `docs/tasks/2026-05-31-crewmon-attendance-pay/01-prd.md`
- 승인 `02-approval.md` · 아키텍처 `03-architecture.md`
- 구현 `04-implementation.md` · 리뷰 `05-review.md`
- 도메인 `CONTEXT.md` · `docs/adr/0001-in-memory-route-handler.md`
