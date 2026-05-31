# 02-approval — 승인 결정 (T7)

- **작성**: orchestrator (사용자 게이트)
- **대상**: `01-prd.md`
- **상태**: ✅ APPROVED (2026-05-31)

## 최종 사용자 결정: APPROVE

| Q | 결정 | 지침 |
|---|---|---|
| Q1 휴게 입력 형식 | **범위형 HH:MM~HH:MM** | 휴게 시작~종료 시각 입력(예 11:30~12:00, 디자인 IMG_3609 일치). 내부 breakMinutes = parseHHMM(end)−parseHHMM(start). |
| Q2 출근 행 상태변경 | **현행 유지** | 출근 행은 기존 즉시 상태변경(StatusChangeSheet) 그대로. 출근시각 불변 원칙. |
| Q3 적용 방식 | **수정요청 수락 반영** | 휴게·퇴근 변경 모두 EditRequest after로 제출 → 수락 시 반영+재계산. 즉시 PATCH 신설 안 함. |

## ⚠️ 범위형 선택의 아키텍처 함의 (architect 필수 반영)
현재 `AttendanceRecord`는 `breakMinutes`(분)만 저장, 휴게 범위(11:30~12:00)는 `DEFAULT_BREAK_RANGE` **표시 상수**일 뿐 레코드에 없음. **범위형 입력/표시를 정합하게 하려면 레코드가 휴게 범위를 저장**해야 함:
- 권장: `AttendanceRecord`에 `breakStart`/`breakEnd`(HH:MM, optional append) 추가. 시드 근무일에 "11:30"/"12:00" 부여. 표시·편집은 breakStart~breakEnd, `breakMinutes`는 파생(end−start)으로 일관.
- `EditRequest.after`에 휴게 범위(breakStart/breakEnd) 또는 breakMinutes를 담는 방식 architect 결정(append-only, optional).
- `approveRequest`/`recalcClockFields`: 휴게 범위 변경 → breakMinutes 갱신 → calcWorkMinutes 재계산. 연장은 clockOut 기준(ADR 0003) 유지.
- planner R1(recalcClockFields의 break=0 복원 로직 vs 명시적 휴게값 충돌) 해소 설계 포함.
- 시드/기존 122 테스트 회귀 0 (breakMinutes 파생이 기존 값과 일치하도록: 11:30~12:00 = 30분).

## 기술 제약
append-only, RSC/client 경계, 기존 122 테스트 회귀 0, T4 approve 흐름·출근시각 불변 유지.
