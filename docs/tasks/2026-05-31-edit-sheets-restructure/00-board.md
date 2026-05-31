# 📋 Task Board — 휴게/퇴근 수정 UI 재구성 (T7)

> teammate / 기존 repo 확장 / feature-based

## 범위 (사용자 지시)
- **휴게 행 '시간변경'**: 현재 잘못 퇴근시각을 수정함 → **휴게시간(범위/분) 수정**으로 변경, 퇴근시각 수정 제거. (사용자 결정: 휴게시간 수정)
- **퇴근 행 '상태변경'**: **퇴근시각 수정 추가**(상태+시각 함께). 적용 = **수정요청 수락 반영**(T4 흐름). (사용자 결정)
- 결과: 퇴근시각 편집이 휴게→퇴근으로 이동, 휴게는 휴게시간 편집.

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 1 기획 | planner | ✅ 완료 | `01-prd.md` (AC 8, sub-task 5) |
| 2 승인 | (user gate) | ✅ APPROVE | `02-approval.md` (Q1 범위형/Q2 현행/Q3 요청) |
| 2.5 아키텍처 | architect | ✅ 완료 | `03-architecture.md` (break범위저장, R1해소, 회귀0증명) |
| 3 구현 | developer | ✅ 완료 (v2) | `04-implementation.md` (138 test, 커밋 725e0b9) |
| 4 리뷰 | reviewer+codex | 🔄 재검증(v2) | `05-review.md` |

## 진행 로그
- 2026-05-31 — T7 시작. 결정: 휴게=휴게시간수정, 퇴근=상태+시각(수정요청 반영).

---

# 🎉 Task 최종 결과 — T7 (rework 1회 후 PASS)

## 결과
- **휴게 '시간변경'** → 퇴근시각 수정 제거, **휴게시간(범위 HH:MM~HH:MM) 수정**으로 교체. `BreakChangeSheet` 신규. 수락 시 breakMinutes 파생 + 근무시간 재계산.
- **퇴근 '상태변경'** → **퇴근시각 입력 추가**(상태 라디오 + clockOut). `ClockOutStatusSheet` 신규. 수정요청 수락 시 clockOut + 연장(clockOut 기준) + 근무 재계산.
- 잘못 배선된 `TimeChangeSheet` 제거. 출근 행 현행 유지. 출근시각(clockIn) 불변.
- 타입: `AttendanceRecord`/`EditRequestChange`에 `breakStart`/`breakEnd` optional append. 시드 근무일 11:30~12:00(=30분, 기존값 일치 → 불변식 보존).
- API 역전 휴게범위(end≤start) 400 거부.
- **검증**: 138 테스트 GREEN(회귀 0), tsc/build/lint 0, codex 코드축 PASS. 커밋 `da5d91c`→`725e0b9` (main).

## 남은 follow-up
- **F-1 (P1)**: `pay/[date]` breakRange 하드코딩 → 레코드 실제 범위 기반으로 교체.
- F-2 (P2): 수정요청 내역에 휴게 범위 변경 표시.
- (기존) /pay 월네비 + "5월 급여" 동적 레이블(6월부터 필요), 자정 갱신.

## 산출물
- `docs/tasks/2026-05-31-edit-sheets-restructure/{01-prd,02-approval,03-architecture,04-implementation,05-review}.md`
- `CONTEXT.md`, `docs/adr/0004-edit-sheet-roles-and-break-edit.md`
