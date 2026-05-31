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
| 3 | 구현 | developer | 🔄 rework v2 | 2026-05-31 | — | `04-implementation.md` (REWORK A: 버그 3건 수정) |
| 4 | 리뷰 | reviewer | ⏸ REWORK A 반환 | 2026-05-31 | — | `05-review.md` (AC 20/20, codex FAIL) |

상태 범례: `미시작` → `진행중` → `완료` / `차단` / `건너뜀`

## 회의록

| # | 주제 | 단계 | 합의 | 파일 |
|---|---|---|---|---|
| — | (아직 없음) | — | — | `meetings/` |

## 진행 로그

- 2026-05-31 — Phase -1 config 로드 (schema_version 9), mode=teammate 오버라이드 적용
- 2026-05-31 — Phase -0.5 구조 분석: feature-based 패턴 사용자 컨펌, 캐시 저장
- 2026-05-31 — Phase 0 artifact 디렉토리 생성, 파이프라인 시작
