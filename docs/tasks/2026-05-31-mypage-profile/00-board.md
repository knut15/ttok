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
| 3 | 구현 | developer | 🔄 진행중 | `04-implementation.md` |
| 4 | 리뷰 | reviewer | 미시작 | `05-review.md` |

## 진행 로그
- 2026-05-31 — T2 시작, config/구조 캐시 재사용, Phase 1 기획 진입
