# 04-implementation — 구현 노트 (task-developer)

- **대상 PRD**: `01-prd.md` (v1, APPROVED) / 승인 `02-approval.md` / 설계 `03-architecture.md`
- **방식**: TDD (RED→GREEN→REFACTOR), mock 0(시스템 경계도 인메모리 store라 mock 불요)
- **결과**: 기존 75 + 신규 25 = **100 테스트 GREEN, 회귀 0**. tsc/build/lint exit 0.

## AC 충족 매핑

| AC | 산출물 | 검증 |
|---|---|---|
| AC-1 레코드 after 반영 | `store.ts` `approveRequest` | `store.test.ts` "대기 요청 수락 시 …전이" |
| AC-2 status 대기→수락(타 요청 불변) | `store.ts` `approveRequest` | `store.test.ts` "다른 대기 요청 status 불변" |
| AC-3 work/overtime 재계산 | `recalcClockFields` + `calcOvertimeByClock` | `store.test.ts` "15:34→458/34" |
| AC-4 결근/휴가 정책 일관 | `approveRequest` status 분기 | `store.test.ts` 결근/휴가 케이스 |
| AC-5 조기출근·정시퇴근 0 | `calcOvertimeByClock` | `time.test.ts`+`store.test.ts` (07:58~15:00→work392/ot0) |
| AC-6 16:30→90 | `calcOvertimeByClock` | `time.test.ts` |
| AC-7 15:00→0 / 15:34→34 | `calcOvertimeByClock` | `time.test.ts` |
| AC-8 수락 API {request,record}/404 | `requests/approve/route.ts` | `route.test.ts` (200/404/400/멱등) |
| AC-9 수락 버튼 UI | `EditRequestList.tsx`(onApprove) + `AttendanceDetail.tsx` 배선 + `useAttendance.ts` approve | 빌드/렌더 + 대기에만 버튼·수락엔 없음 |
| AC-10 월 이동 | `AttendanceCalendarView.tsx` + `shiftMonth` + `page.tsx` | `date.test.ts` shiftMonth + 빌드 |
| AC-11 빈 달 graceful | 기존 `buildMonthGrid`/`getMonthRecords` 재사용 | 빌드(임의 월 그리드) |
| AC-12 회귀 0 | 전체 append-only | `pnpm test` 75→100 회귀 0 |

## ST별 완료 (TDD 사이클)

| ST | 사이클 | RED 캡처 | GREEN |
|---|---|---|---|
| ST-1 연장 정합 함수 | RED→GREEN | `calcOvertimeByClock is not a function`(8 fail) | time 19/19 (+8) |
| ST-4 shiftMonth | RED→GREEN | 4 fail(함수 부재) | date 9/9 (+4) |
| ST-2 approveRequest | RED→GREEN→REFACTOR | 9 fail(함수 부재) | store 21/21 (+9). REFACTOR: `recalcClockFields` 헬퍼로 `updateStatus`/`upsertTodayClock`/`approveRequest` 연장 산정 단일화(DRY) |
| ST-3 수락 API | RED→GREEN | route 모듈 부재(import fail) | route 4/4 (+4) |
| ST-3 hook/UI | 배선(이미 테스트된 store/route 조합) | — | 빌드 GREEN |

- Horizontal slicing 여부: ❌ (각 함수 단위 vertical slice, RED 실제 실패 확인 후 최소 GREEN)
- 내부 협력자 mock: 0건 (store는 인메모리 진실원, 공개 인터페이스로 행위 검증)

## 자가 검증 (실측)

- `pnpm test`: ✅ **100 passed (15 files)** — 기존 75 회귀 0 + 신규 25
  - 신규 내역: time +8, date +4, store +9, approve route +4
- `pnpm exec tsc --noEmit`: ✅ exit 0
- `pnpm build`: ✅ exit 0 (Compiled successfully, 7 API 라우트 + 8 페이지. `/api/attendance/requests/approve` 신규 노출 확인)
- `pnpm lint`: ✅ exit 0

## 경계면 일치 확인

- approve body `{id}` ↔ route `{id}` ↔ `approveRequest(id: string)` — 일치.
- 응답 `{request, record}` ↔ `ApproveResult`(types/index.ts append) ↔ `EditRequest`/`AttendanceRecord`(불변) — 일치.
- 월 GET `?month=` ↔ 기존 `getMonthRecords(month)` — 계약 재사용(변경 0).
- `AppHeader.title` 타입 `string`→`ReactNode` 확대(append-only, string은 ReactNode 부분집합 → 기존 호출 호환).

## 설계 준수 / 이탈

- 설계 §1~§4 그대로 구현. `calcOvertime` 불변(append-only), 호출부만 `calcOvertimeByClock`로 교체.
- **유일한 명세 보정**: PRD §10/설계 F16이 ADR 파일명을 `0001-overtime-by-clockout.md`로 적었으나, 레포에 0001·0002가 이미 존재 → "최대 번호+1" 규칙으로 **`docs/adr/0003-overtime-by-clockout.md`** 채번. (설계 이탈 아님, 번호 충돌 회피)

## Repository Artifacts

- `CONTEXT.md`: "연장근무"·"실근무 인정" 행을 clockOut 기준(`max(0, clockOut−900)`)으로 정밀화 + "근무기록 수정요청" 행에 수락 반영(after+재계산·upsert·멱등·`{request,record}`) 명문화. 추가/정밀화 용어 3행.
- `docs/adr/0003-overtime-by-clockout.md` 신규: 연장 산정 기준 변경 + 수락 멱등(Q2)/upsert(Q1) 정책.

## 변경/신규 파일

신규: `src/app/api/attendance/requests/approve/route.ts`(+`.test.ts`), `src/features/attendance/components/AttendanceCalendarView.tsx`, `docs/adr/0003-overtime-by-clockout.md`, 본 노트.
수정(append/호출부): `constants.ts`, `time.ts`(+test), `store.ts`(+test), `date.ts`(+test), `types/index.ts`, `useAttendance.ts`, `EditRequestList.tsx`, `AttendanceDetail.tsx`, `AppHeader.tsx`, `app/attendance/page.tsx`, `CONTEXT.md`.
