# 📋 Task Board — 시간수정 승인반영 + 달력 월이동 (T4)

> teammate / 기존 repo 확장 / feature-based(캐시)

## 범위 (사용자 결정)
1. **근무시간 수정** = 수정요청 **수락 시 반영**. 요청내역에 '수락' 버튼 → 수락 시 after(출/퇴근시각·상태)를 레코드에 반영 + 근무/연장/급여 재계산, 요청 status 대기→수락.
2. **달력 이전달 보기** = 자유 월 이동(이전/다음), 시드 없는 달은 빈 캘린더(graceful).
- **겸사**: T3 follow-up(연장 재계산 정합) — 수락-반영 재계산 시 연장을 정시 퇴근(15:00) 초과분 기준으로 정합 처리.

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 1 기획 | planner | ✅ 완료 | `01-prd.md` (AC 12, sub-task 4) |
| 2 승인 | (user gate) | ✅ APPROVE | `02-approval.md` (Q1/Q2/Q4 결정) |
| 2.5 아키텍처 | architect | ✅ 완료 | `03-architecture.md` (연장정합+DRY, 4/4) |
| 3 구현 | developer | 🔄 진행중 | `04-implementation.md` |
| 4 리뷰 | reviewer+codex | 미시작 | `05-review.md` |

## 진행 로그
- 2026-05-31 — T4 시작. 결정: 시간수정=수락반영, 달력=자유이동+빈달허용. T3 연장정합 겸사 해소.
