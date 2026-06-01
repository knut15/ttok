# 📋 Task Board — 출퇴근 등록 FAB + cursor pointer (T11)

> teammate / 기존 repo / feature-based / 2026-06-01

## 범위 (사용자 결정)
1. **출퇴근 등록 FAB**: `/attendance`(출퇴근 탭) 우하단 플로팅 버튼 → **오늘 출/퇴근 등록**(현재시각, 크루 스코프 = 홈 ClockToggle과 동일 로직). 상태 인지(출근/퇴근/마감). 날짜클릭은 상세(보기/수정) 유지. 홈 ClockToggle 유지(두 곳 등록 가능).
2. **cursor: pointer**: 클릭 이벤트 있는 모든 버튼/아이콘에 cursor:pointer(전역 base 규칙, disabled 제외).

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 1 기획 | planner | ✅ 완료 | `01-prd.md` (AC 14, sub-task 4) |
| 2 승인 | (user gate) | ✅ APPROVE | `02-approval.md` (Q1 즉시등록 / Q2 마스터노출) |
| 2.5 아키텍처 | architect | ✅ 완료 | `03-architecture.md` (useTodayClock 추출·z-40·안A) |
| 3 구현 | developer | 🔄 진행중 | `04-implementation.md` |
| 4 리뷰 | reviewer+codex | 미시작 | `05-review.md` |

## 진행 로그
- 2026-06-01 — T11 시작. FAB(오늘 등록, 출퇴근탭, 홈유지) + cursor:pointer 전역.
