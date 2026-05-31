# 📋 Task Board — 계정/권한 분리 마스터·크루 (T8)

> teammate / 기존 repo 대규모 확장 / feature-based

## 범위 (사용자 결정)
- **인증**: 데모 역할 전환(mock) — 로그인 없이 mock 계정(마스터 1 + 크루 N) + 상단 사용자/역할 전환.
- **데이터**: 멀티 크루 2~3명 mock 시드(각자 근무기록/스케줄), 마스터 1명.
- **전체 4요구**:
  1. 마스터 = 전체 크루 근무/휴일 조회 (마스터 전용 집계 뷰)
  2. 크루 = 초대로만 합류 (초대 코드/링크 mock 플로우)
  3. 크루 = 본인 스케줄만 조회 (현재 사용자 크루로 스코프)
  4. 변경 컨펌(수락) = 마스터만 (EditRequestList 수락 버튼 마스터 전용 게이트)

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 1 기획 | planner | ✅ 완료 | `01-prd.md` (AC 19+5, sub-task 8) |
| 2 승인 | (user gate) | ✅ APPROVE | `02-approval.md` (B/C/E + 내부 A/D) |
| 2.5 아키텍처 | architect | ✅ 완료 | `03-architecture.md` (헤더+fallback 회귀0, 8 sub-task 순서) |
| 3 구현 | developer | 🔄 rework v2 | `04-implementation.md` (REWORK A: AC-11 드릴다운 + E-3 stale) |
| 4 리뷰 | reviewer+codex | ⏸ REWORK A | `05-review.md` (권한경계 OK, codex P1-2/P1-3) |

## 진행 로그
- 2026-05-31 — T8 시작. mock 역할전환 / 전체범위 / 크루 2~3명. 최대 규모 task.
