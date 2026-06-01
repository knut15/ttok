# 05-review — T15 과거 누락 근무기록 추가 (리뷰 보고서 v1)

- 작성자: task-reviewer
- 기준: 01-prd / 02-approval(APPROVED) / 03-architecture / 04-implementation
- 검증일: 2026-06-01
- 최종 판정: **PASS**

---

## AC 매트릭스

| AC# | 내용 | 충족 증거 | 일치 |
|---|---|---|---|
| AC-1 | 빈 날짜 추가 진입 | `AttendanceDetail.tsx:83-113` — `!record` 분기에서 `AddRecordForm` 노출 | ✅ |
| AC-2 | 기록 있는 날 미노출 | `AttendanceDetail.tsx:113-252` — `record!==null` 분기(기존 편집 카드) 불변, git diff 미변경 | ✅ |
| AC-3 | 입력 필드 | `AddRecordForm.tsx:41-80` — 상태 라디오 5종(기본 정상) + 출근 time + 퇴근 time + 사유 textarea | ✅ |
| AC-4 | 제출 → 대기 생성 | `add-missing-record.test.ts:30-68` — POST 201, status="대기", crewId="crew-2" 확인 | ✅ |
| AC-5 | before 빈 스냅샷 | `add-missing-record.test.ts:50` — `req.before` = `{status:"정상", clockIn:null, clockOut:null}` 단언 | ✅ |
| AC-6 | 크루 본인 스코프 | `add-missing-record.test.ts:118-133` — crew-2 추가 수락 후 `getRecord("2026-05-16","crew-minjung")===null` | ✅ |
| AC-7 | 수락 → upsert 생성 | `add-missing-record.test.ts:56-68` — 수락 후 `rec.workMinutes===390`, `rec.clockIn==="08:00"` | ✅ |
| AC-8 | 캘린더/월조회 반영 | `add-missing-record.test.ts:72-91` — 수락 후 `getMonthRecords("2026-05","crew-2")` 포함 | ✅ |
| AC-9 | 마스터 컨펌 목록 표시 | `MasterRequestList.tsx:36-39` — `requestKindLabel(req.before)` 라벨 표시, 추가요청 자동 포함(필터 없음) | ✅ |
| AC-10 | 크루 본인 요청내역 표시 | `AttendanceDetail.tsx:103-112` — `EditRequestList` date 필터 배치(record=null 분기) | ✅ |
| AC-11 | 역전/형식 검증 | `route.test.ts:214-261` — 역전(09:00/08:00)→400, 동일(09:00/09:00)→400, 정상→201. `domain.ts:101-110` `canSubmitAddRecord` 폼 비활성 | ✅ |
| AC-12 | 사유 빈값 | `AddRecordForm.tsx:30-31` — `trimmed.length>0` 필수(버튼 비활성). `route.ts:41-45` — 빈사유 400(무변경) | ✅ |
| Q3 미래 거부 | 폼 + 서버 이중 방어 | `AttendanceDetail.tsx:85-90` — `date>todayDate()` 안내 미노출. `route.ts:50-55` — 미래 날짜 400 | ✅ |
| Q4 추가/수정 라벨 | before 파생 경량 구분 | `domain.ts:117-123` `requestKindLabel`. `EditRequestList.tsx:31-33`, `MasterRequestList.tsx:36-39` 적용 | ✅ |
| Q5 역전 400 | POST 검증 추가 | `route.ts:82-91` — `clockIn!=null && clockOut!=null && parseHHMM(out)<=parseHHMM(in)→400`. 진입 가드(둘다 non-null) | ✅ |
| AC-R1 | 206 회귀 0 | `pnpm test --run`: 226/226 통과 (기존 206 + 신규 20, 감소 0) | ✅ |
| AC-R2 | 기존 수정요청 흐름 불변 | `AttendanceDetail.tsx:113-252` record≠null 분기 git diff 미변경 | ✅ |
| AC-R3 | 수락/upsert 멱등 불변 | `store.ts` 무변경 (git diff 빈 출력 확인). `approveRequest` L315-391 그대로 | ✅ |
| AC-R4 | 마스터 게이트 유지 | `store.ts` 무변경. approve route 미변경(기존 role≠master→403 유지) | ✅ |
| AC-R5 | 캘린더 불변 | `getMonthRecords` 무변경. 신규 레코드는 비어있던 날짜에만 생성(기존 레코드 덮어씀 없음) | ✅ |
| AC-R6 | 단일일 상세 계약 불변 | `/api/attendance/[date]` route 미변경. `isValidDateString` 실패만 404, 유효 날짜 200+null 유지 | ✅ |
| AC-Proj-1 | 컨벤션 준수 | 신규 파일 `"use client"` 표시, `src/features/attendance/components/` 배치, 타입 import 분리 | ✅ |
| AC-Proj-2 | 명시된 자원 활용 | `useEditRequests.submit`, `parseHHMM`, `todayDate`, `EditRequestList`, `requestKindLabel` 모두 재사용 | ✅ |
| AC-Proj-3 | 발견된 craft 우선 활용 | store/route/hook 무변경 재사용. 신규 store 함수 0 | ✅ |
| AC-Struct-1 | 신규 파일 배치 | `AddRecordForm.tsx` → `src/features/attendance/components/` (architect §1 일치) | ✅ |
| AC-Struct-2 | 폴더 책임 침범 금지 | domain 로직 `domain.ts`에 집중, 컴포넌트→훅→route 단방향 의존성 유지 | ✅ |
| AC-Struct-3 | user_notes 규칙 준수 | feature-based append-only 패턴 준수 | ✅ |
| AC-Repo-1 | CONTEXT.md 갱신 | `CONTEXT.md` §"근무기록 수정요청" T15 문구 보강 + §"편집 시트 역할" T15 문구 보강 (grep T15 → 2건 확인) | ✅ |
| AC-Repo-2 | ADR 작성 | `docs/adr/0007-add-missing-record.md` 신규 작성 — 결정 2건(빈날짜상세통합, 스키마통합) + 부수 결정 2건 | ✅ |
| AC-Repo-3 | 갱신 시점 적절성 | git log: CONTEXT.md/ADR 0007 변경이 코드 변경과 동일 커밋 `0116211` | ✅ |

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC (구조/Repo/Proj 포함): 28개
- file:line 증거: 22개
- test ID 증거 (*.test.ts > it 설명): 6개
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 28/28 = **100%**

---

## 경계면 검증

### AddRecordForm.onSubmit ↔ AttendanceDetail submit 배선
- `AddRecordForm.tsx:104-108` — `onSubmit({status, clockIn, clockOut: clockOut===""?null:clockOut, reason})`
- `AttendanceDetail.tsx:95-101` — `submit({date, reason, after:{status, clockIn, clockOut}})` (before 미전송)
- `POST /api/attendance/requests` body 계약: `{date, reason, after:{status, clockIn, clockOut}}` — 일치 ✅

### canSubmitAddRecord(폼) ↔ route Q5 검증(서버)
- `domain.ts:101-110` — `clockOut===""` 허용, 명시 시 `out>in` 강제
- `route.ts:82-91` — `clockIn!=null && clockOut!=null && parseHHMM(out)<=parseHHMM(in)→400`
- 정책 동일(폼 1차 비활성 + 서버 방어), `clockOut=null` 허용 진입 가드 동일 — 일치 ✅

### requestKindLabel ↔ store addRequest L292 빈 스냅샷 규칙
- `domain.ts:118-122` — `clockIn===null && clockOut===null && status==="정상"` → "추가"
- `store.ts:292` — 레코드 없는 날: `{status:"정상", clockIn:null, clockOut:null}` 자동 생성
- 1:1 대응 — 일치 ✅

### EditRequestChange.clockOut 타입 ↔ Q2 퇴근 선택
- `types/index.ts`의 `clockOut: string|null` 이미 null 지원 → 타입 변경 없음
- `AddRecordForm.tsx:107` — `clockOut===""?null:clockOut` 로 null 변환
- 일치 ✅

---

## 빌드/테스트 결과

- 빌드: ✅ `pnpm build` 성공 (Next.js 정적+동적 라우트 전체 컴파일)
- 타입체크: ✅ `npx tsc --noEmit` exit 0 (출력 없음)
- lint: ✅ `pnpm lint` clean (출력 없음)
- 단위/통합 테스트: ✅ 226/226 통과 (Test Files 24 passed)
  - 신규 테스트 구성: domain.test.ts +11건 (canSubmitAddRecord 7 + requestKindLabel 4), route.test.ts +5건 (Q5 역전 2 + 정상추가 1 + 출근만 1 + 미래 1), add-missing-record.test.ts +4건 (S3 통합 4)
  - 기존 206 감소 0 (AC-R1)

---

## 회귀 검증

### Q5 역전 가드 — 기존 요청 미영향 확인

`route.ts:84` — `if (body.after.clockIn != null && body.after.clockOut != null)` 진입 조건:
- 기존 휴게변경 요청: `after.clockIn`, `after.clockOut` 미포함 케이스 → 진입 가드 non-null 미충족 → 미진입
- clockOut=null 요청(Q2): `clockOut===null` → 진입 가드 미충족 → 미진입
- 역전 가드가 기존 수정요청을 깨지 않음 확인. `route.test.ts` 기존 휴게 역전 테스트 226 통과로 재확인.

### store(addRequest/approveRequest) 무변경 확인

`git diff HEAD~1 -- src/lib/store.ts` → 빈 출력 (변경 없음). store 무변경 가정 S3 통합테스트로 확정.

### record≠null 상세 불변

`AttendanceDetail.tsx:113` 이후 — `git diff` 미변경 구간. 기존 `EditRequestForm`/`StatusChangeSheet`/`ClockOutStatusSheet`/`BreakChangeSheet` 경로 완전 불변.

### 마스터 게이트 불변

approve route 미변경. `MasterRequestList.tsx` 라벨만 추가, 수락 버튼/게이트 로직 불변.

---

## 🤝 교차 검증 (codex review)

- 자체 판정(하네스축): PASS
- codex 판정: P1 없음 / **P2 2건**
- 호출 시각: 2026-06-01 (base: def2cc8, codex v0.135.0 gpt-5.5)
- 최종 결정: **PASS 확정** (P2 2건은 nit — 아래 분석)

### codex P2 지적 상세 분석

**P2-1: 마스터 계정이 /attendance/[past-date] 열면 AddRecordForm이 노출됨**
(`AttendanceDetail.tsx:94-102`)

분석:
- 마스터(`master-1`)는 `CONTEXT.md` §"마스터": "본인 근무기록은 없을 수 있음" — 의도적으로 출퇴근 레코드 없는 계정.
- 마스터가 `/attendance/[date]`를 직접 열면 `useDayAttendance` 호출 시 `master-1` 스코프 → 레코드 없음 → AddRecordForm 노출.
- 마스터가 폼 제출 → `POST /api/attendance/requests` → `readScope(request).crewId = "master-1"` 태그 → 대기 요청 생성.
- 마스터가 자신의 요청을 `MasterRequestList`에서 수락 가능 → `master-1` 레코드 생성 가능.

판정 근거:
- PRD AC-1~AC-6은 모두 "크루 본인" 명시이나, **마스터가 이 페이지에 진입하는 시나리오를 명시적으로 차단하는 요구사항이 없음**. CONTEXT.md §"마스터": 마스터는 `BottomNav` 2탭(집계+마이페이지)만 보유 — `/attendance` 탭 자체가 마스터 BottomNav에 없음.
- 마스터가 URL 직접 입력으로 `/attendance/[date]`에 진입하는 시나리오는 **현행 앱 구조(BottomNav 탭 미노출)에서 비공식 경로**이며, 이를 PRD/approval이 명시 요구한 바 없음.
- 설사 마스터가 진입해도 master-1 이름으로 기록 생성 → 급여 집계 대상(크루만 집계, `getCrewSummaries`가 크루 only) 아님. 데이터 오염 범위 한정.
- **결론**: 기능 결함이 아닌 경계 케이스 — PRD/approval 명시 AC 미위배. **P2(nit) — follow-up 후보로 등록**.

**P2-2: 서버와 클라이언트 타임존이 다를 때 오늘 날짜 기준 불일치**
(`route.ts:50`)

분석:
- `todayDate()`는 `date.ts L70`에 "UTC 변환 금지(toISOString 회피 — 날짜 밀림 방지)"로 **의도적 로컬 타임존** 정책. 이 결정은 T15 이전부터 전체 앱에 일관 적용(`ClockFab.tsx`, `HomeToday.tsx` 등).
- T15가 `todayDate()`를 새로 도입한 것이 아니라 기존 패턴 그대로 재사용.
- PRD §"비목표": "실 DB·인증 도입(인메모리 store 유지)". 인메모리 mock 앱으로, UTC vs 로컬 타임존 배포 불일치는 본 task 범위 밖.
- **결론**: 기존 앱 전역 정책(로컬 타임존) 계승이며 신규 결함 아님. **P2(nit) — 별도 task로 분리 가능한 전역 개선 주제**.

---

## 최종 판정

- **판정: PASS**
- 사유: AC 1~12 전부 충족(정량 증거 28/28), 경계면 일치, 226/226 통과(기존 206 회귀 0), store 무변경, Q5 역전 가드 회귀 0, codex P1 없음 P2 2건 분석 결과 PRD AC 위배 없음(기존 패턴 계승 + 비공식 진입 경계 케이스).
- 회귀 지점: 없음 (Done)
- 수정 요청 항목: 없음

---

## Follow-up 후보 (별도 task)

| 우선도 | 항목 | 근거 |
|---|---|---|
| P2 | 마스터 계정의 AddRecordForm 진입 명시 차단 | codex P2-1. 마스터 BottomNav에 /attendance 탭 없어 비공식 경로이나, 방어적 role 가드(`user.role === "crew"` 조건) 추가 시 명확성 향상 |
| P2 | 서버 미래 날짜 기준을 비즈니스 타임존(KST)으로 통일 | codex P2-2. 현행 전역 로컬 타임존 정책 재검토 — 별도 타임존 전략 task로 분리 권장 |
