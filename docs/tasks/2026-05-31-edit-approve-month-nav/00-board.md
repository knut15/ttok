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
| 3 구현 | developer | ✅ 완료 (v3) | `04-implementation.md` (106 test, 커밋 3e152e0) |
| 4 리뷰 | reviewer+codex | ✅ PASS | `05-review.md` (AC 14/14, codex PASS) |

## 진행 로그
- 2026-05-31 — T4 시작. 결정: 시간수정=수락반영, 달력=자유이동+빈달허용. T3 연장정합 겸사 해소.

---

# 🎉 Task 최종 결과 — T4

## 결과 (rework 2회 후 PASS)
- **기능1 시간수정**: 수정요청 '수락' 시 after(상태+퇴근시각) 레코드 반영 + 재계산. **퇴근만 수정 가능**(출근 읽기전용, 사용자 지시 AC-13/14). approveRequest(upsert/멱등/fail-closed).
- **기능2 달력 월이동**: ‹ 월라벨 › 화살표, shiftMonth 연/월 경계, 빈 달 graceful.
- **T3 follow-up 해소**: 연장 = clockOut 기준(`calcOvertimeByClock`), 조기출근 연장 아님. seed 불변식② 보존.
- **검증**: 106 테스트 GREEN(회귀 0), tsc/build/lint 0, codex 코드축 PASS.
- **커밋**: `804dd91`(v1) → `c57e13f`(v2 after검증) → `3e152e0`(v3 undefined+퇴근만).

## 남은 follow-up
- **P1 (사용자 결정)** seed 5/04 overtime 34→0, 5/24 130→60 drift — 새 연장정책(clockOut 기준)이 참조 이미지(조기출근=연장)와 모순. 시드 리터럴 정정 vs 현행 유지 결정 필요.
- P2 clockOut<clockIn 역전 명시 400, P3 approve 에러 UI 노출.

## 산출물
- `docs/tasks/2026-05-31-edit-approve-month-nav/{01-prd,02-approval,03-architecture,04-implementation,05-review}.md`
- `CONTEXT.md`, `docs/adr/0003-overtime-by-clockout.md`
