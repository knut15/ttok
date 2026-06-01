# 📋 Task Board — 크루 출근격리 + 마스터 컨펌 + 아이콘버튼 32x32 (T10)

> teammate / 기존 repo 확장 / feature-based / 2026-06-01

## 범위 (사용자 지시 3건)
1. **크루 출근 격리 버그**: `ClockToggle`(홈 토글)이 authHeaders 미전송 → 모든 크루가 김민정(기본) 오늘 레코드 공유 → 한 명 출근 시 전원 출근 표시. → ClockToggle을 현재 크루 스코프로 수정(개별 적용).
2. **마스터 수정요청 컨펌**: 크루가 근태 수정요청 시 마스터가 전체 크루 수정요청을 보고 **수락(컨펌)**할 수 있어야. 현재 마스터가 볼 UI/API 없음. → 마스터 전체 수정요청 목록 + 수락(마스터 게이트 기존 재사용).
3. **아이콘 버튼 32x32**: 아이콘 전용 버튼들(‹ ›, 🔔, 📷, 뒤로 등)의 클릭 영역을 32×32(w-8 h-8)로 통일.

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 1 기획 | planner | ✅ 완료 | `01-prd.md` (AC 17, sub-task 5) |
| 2 승인 | (user gate) | ✅ APPROVE | `02-approval.md` (Q1 /master섹션 / Q4 클릭버튼만) |
| 2.5 아키텍처 | architect | ✅ 완료 | `03-architecture.md` (서버조인·12버튼·회귀0) |
| 3 구현 | developer | 🔄 진행중 | `04-implementation.md` |
| 4 리뷰 | reviewer+codex | 미시작 | `05-review.md` |

## 진행 로그
- 2026-06-01 — T10 시작. ClockToggle 스코프 / 마스터 컨펌 / 아이콘 32x32.
