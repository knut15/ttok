# 04-implementation — T15 과거 누락 근무기록 추가 (구현 노트)

- 작성자: task-developer
- 기준: 01-prd / 02-approval(✅) / 03-architecture(§developer 인계)
- 방식: TDD vertical slice (RED→GREEN→REFACTOR), append-only, 회귀 0

## AC 충족 매핑

| AC | 충족 위치 | 비고 |
|---|---|---|
| AC-1 빈날짜 추가진입 | `AttendanceDetail.tsx` record=null 분기 교체 → `AddRecordForm` | dead-end 제거 |
| AC-2 기록있는날 미노출 | record≠null 분기 **불변**(코드 미변경) | tsc/build 회귀 0 |
| AC-3 입력필드 | `AddRecordForm.tsx`(상태 라디오5+출근/퇴근 time+사유) | 검증 `canSubmitAddRecord` |
| AC-4 제출→대기생성 | `useEditRequests.submit`(재사용) → route POST 201 | S3 통합테스트 |
| AC-5 before 빈스냅샷 | store `addRequest`(무변경) before 자동 | S3 `req.before` 검증 |
| AC-6 크루 본인스코프 | route `readScope().crewId`(무변경) | S3 격리 테스트(2026-05-16) |
| AC-7 수락→upsert 생성 | `approveRequest`(무변경) `newRecordFrom` | S3 work 390 재계산 |
| AC-8 캘린더/월조회 반영 | `getMonthRecords`(무변경) | S3 포함 검증 |
| AC-9 마스터 컨펌 목록 | `GET /api/master/requests`(무변경, 자동 포함) | 라벨만 추가 |
| AC-10 본인 요청내역 | `EditRequestList`(date 필터, 재사용) | record=null 분기에 배치 |
| AC-11 역전/형식 검증 | route POST Q5 1블록 + 폼 `canSubmitAddRecord` | 09:00/08:00→400 |
| AC-12 사유 빈값 | `AddRecordForm` trim 비활성 + route 빈사유 400(무변경) | |
| Q3 미래 | `AttendanceDetail` 안내 + route `date>todayDate()`→400 | 폼+서버 이중 |
| Q4 라벨 | `requestKindLabel` → EditRequestList/MasterRequestList | 표시 전용 |
| AC-R1~R6 | 기존 206 불변(아래 자가검증) | append-only |

## 변경/신규 파일

| 종류 | 파일 |
|---|---|
| 신규 | `src/features/attendance/components/AddRecordForm.tsx` |
| 신규(테스트) | `src/app/api/attendance/requests/add-missing-record.test.ts` (S3 통합 4건) |
| 수정 | `src/features/attendance/components/AttendanceDetail.tsx` (record=null 분기 교체) |
| 수정 | `src/app/api/attendance/requests/route.ts` (Q5 역전 + Q3 미래 방어) |
| 수정 | `src/features/attendance/components/EditRequestList.tsx` (Q4 라벨) |
| 수정 | `src/features/accounts/components/MasterRequestList.tsx` (Q4 라벨) |
| 수정 | `src/features/attendance/domain.ts` (`canSubmitAddRecord`, `requestKindLabel` 추가) |
| 수정(테스트) | `src/features/attendance/domain.test.ts` (폼검증 7 + 라벨 4) |
| 수정(테스트) | `src/app/api/attendance/requests/route.test.ts` (Q5 2 + 정상추가 1 + 출근만 1 + 미래 1) |
| 문서 | `CONTEXT.md`(EditRequest/AttendanceDetail 보강 2건), `docs/adr/0007-add-missing-record.md`(신규) |

**store.ts / useAttendance.ts / approveRequest / addRequest / EditRequestForm 무변경**(upsert·submit 재사용 — 백엔드 무변경 가정 S3로 확정).

## TDD 사이클 (vertical slice, horizontal slicing 미사용)

| # | behavior | RED | GREEN |
|---|---|---|---|
| 1 | route Q5 clock 역전 400 | 역전/동일 2건 실패(201) | route.ts Q5 1블록(둘다 non-null 가드) |
| 2 | route Q3 미래날짜 400 | 9999-12-31 실패(201) | route.ts `date>todayDate()` 방어 |
| 3 | S3 add→approve→upsert | (격리 date 시드충돌 1건 → 테스트 date 교정) | store 무변경 확인(GREEN) |
| 4 | `canSubmitAddRecord` 순수검증 | 7건 실패(미export) | domain.ts 함수 추가 |
| 5 | `requestKindLabel` Q4 파생 | 4건 실패(미export) | domain.ts 함수 추가 |

UI(AddRecordForm/AttendanceDetail/라벨)는 node+`.test.ts`-only vitest 환경상 컴포넌트 렌더 테스트 불가 → 검증 로직을 순수 함수로 추출(사이클 4·5)해 단위테스트, 배선은 tsc+build+lint+코드일치로 검증.

## 자가 검증 (직접 Bash)

- 빌드: ✅ `pnpm build` 성공
- 타입체크: ✅ `npx tsc --noEmit` exit 0
- lint: ✅ `pnpm lint` clean
- 단위/통합 테스트: ✅ 226/226 (기존 206 + 신규 20, **회귀 0**)

## 경계면 일치 확인

- AddRecordForm.onSubmit `{status,clockIn,clockOut,reason}` ↔ AttendanceDetail이 `submit({date,reason,after:{status,clockIn,clockOut}})`로 매핑(before 미전송).
- 폼 검증 `canSubmitAddRecord`(out>in) ↔ route Q5(out<=in→400) **동일 정책** — UX 1차 + 서버 방어 정합.
- before 빈 판별 `requestKindLabel`(`clockIn===null&&clockOut===null&&status==="정상"`) ↔ store `addRequest` L292 빈 스냅샷 생성 규칙과 1:1.
- `EditRequestChange.clockOut: string|null` 이미 null 지원 → 퇴근 선택(Q2) 타입 변경 불필요.

## 설계 이탈 사유

없음. architect §1~§4 그대로 구현. (route 미래 방어는 §1에서 "선택이나 권장"으로 명시 → 채택.)
