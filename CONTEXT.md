# CONTEXT — Crewmon 출퇴근·급여 앱 도메인 용어집

> 이 문서는 프로젝트의 도메인 캐논(canonical) 정의다. 코드/PRD/리뷰가 같은 의미로 용어를 쓰도록 단일 출처 역할을 한다.
> 참조 디자인: `public/sample/IMG_3606~3619.png` (Crewmon 앱). 범위: 홈 / 출퇴근 / 급여 / 마이페이지 / 프로필.

## 핵심 용어

| 용어 | 정의 |
|---|---|
| **근무시간** (workMinutes) | 퇴근시각 − 출근시각 − 휴게시간. 분(minute) 단위. 시각 역전·음수는 0으로 하한 처리. |
| **휴게시간** (breakMinutes) | 근무 중 무급 휴게(예 11:30~12:00 = 30분). 근무시간에서 차감. **휴게는 범위(`breakStart`~`breakEnd`, HH:MM)로 저장**하며 `breakMinutes`는 `calcBreakMinutes`(`src/lib/time.ts`, `max(0, breakEnd−breakStart)`) 파생 캐시다(범위 없으면 기존 분값 유지, ADR 0004). 휴가일은 범위 미부여(0). |
| **급여인정시간** (paidMinutes) | 근무시간에서 급여차감시간을 뺀, 급여 산정 기준 시간. `max(0, workMinutes − deductMinutes)`. 휴가일은 0. |
| **급여차감시간** (deductMinutes) | 지각·결근 등으로 근무로 인정되지 않아 급여인정시간에서 제외되는 시간(분). |
| **결근 차감 정책** | 결근 = 정규 전액 차감. `updateStatus(date,"결근")` 시 `deductMinutes = REGULAR_MINUTES(390)`, `workMinutes/overtimeMinutes/breakMinutes = 0`(clockIn/clockOut 보존) → 급여인정시간 0원. 결근과 휴가는 의미가 다르다(차감 vs 단순 0원). |
| **휴가 차감 정책** | 휴가 = 무급(차감 아님). `deductMinutes = 0`, work/overtime/break = 0. 일급 0원이되 급여차감시간 합산에 포함되지 않는다. |
| **실근무 인정** | `workMinutes`는 실제 clock(출/퇴근 시각) 기준으로 산정한다. 조기 출근분도 정규 인정시간에 포함되며(예 5/28 07:58 출근 → 392분), 연장(overtimeMinutes)은 **정시 퇴근(정규 종료시각 15:00=900분) 초과분만** 인정한다. 정시에 퇴근하면 조기출근으로 근무가 392분이어도 연장은 0이다. |
| **연장근무** (overtimeMinutes) | 정시 퇴근(정규 종료시각 15:00=900분) 초과분. 급여·캘린더에서 별도 집계·표기. **`max(0, parseHHMM(clockOut) − 900)`, clockIn·workMinutes 무관**(ADR 0001). `src/lib/time.ts` `calcOvertimeByClock`. 조기출근으로 workMinutes가 390을 넘어도 정시 퇴근이면 연장 0. (이전 `workMinutes − 390` 표현은 조기출근 시 연장 오산정 → ADR 0001로 교정.) |
| **정규 근무시간** | 기준선 08:00~15:00, 휴게 30분 → 390분(6시간30분). `src/lib/constants.ts`. |
| **일급** (dailyPay/amount) | `round(급여인정시간/60 × 시급)`. 휴가일은 0원. 검산: 390분 × 10,320원 = 67,080원. |
| **주휴수당** (weeklyHolidayPay) | 주 소정근로 충족 시 지급되는 별도 급여 항목. 급여 리스트에서 **블루 별도 행**. 본 구현은 시드 고정값(67,080원 1건)으로 처리(산식 비구현). |
| **출근상태** (WorkStatus) | `정상 / 지각 / 결근 / 휴가 / 연장` 5종 enum. |
| **근무기록 수정요청** (EditRequest) | 출퇴근/상태 정정 요청. 사유(0~100자) 입력 후 생성. 상태 `대기 → 수락` 추적. **수락 시 해당 날짜 레코드에 `after`(status·clockIn·clockOut·`breakStart`?·`breakEnd`?)를 반영하고 work/overtime(연장 정합)·차감 정책을 재계산**한다(`approveRequest`, `POST /api/attendance/requests/approve`). `after`에 휴게 범위가 명시되면 그것을 진실원으로 `breakMinutes`를 파생·반영하고 work를 재계산한다(0이어도 DEFAULT 복원 없이 존중, ADR 0004 R1). 휴게 범위 미명시 요청은 기존 휴게를 그대로 두는 멱등 동작. **출근시각(clockIn)은 모든 편집 경로에서 불변**(실제 기록값). 레코드 없는 날은 after 로 신규 생성(upsert), 이미 수락된 요청 재수락은 멱등 no-op(레코드 불변). 응답은 `{request, record}`(ApproveResult). 거절/철회/수락취소는 미지원. **T15(과거 누락 추가): 레코드 없는 과거/오늘 날짜에서 크루가 출/퇴근·상태를 직접 입력해 추가요청(before 빈 스냅샷 `{정상, null, null}`)을 생성하고, 마스터 수락 시 `approveRequest` upsert 로 레코드를 신규 생성한다(백엔드 무변경, `addRequest`/`approveRequest` 재사용). 추가 vs 수정은 `before` 빈값(`clockIn===null && clockOut===null && status==="정상"`, `requestKindLabel`)으로 파생 판별(표시 전용, 스키마 무변경, ADR 0007). 미래 날짜는 추가 불가(`POST` 서버 방어 `date>todayDate()`→400 + 폼 미노출, Q3). clockIn·clockOut 둘 다 명시면 `clockOut<=clockIn`(역전·동일) 거부(`POST` Q5 검증 + 폼 비활성, `canSubmitAddRecord`); 한쪽 null/휴게 요청은 진입 가드로 미진입(회귀 0).** |
| **편집 시트 역할** (AttendanceDetail) | **출근 행 = 상태변경**(`StatusChangeSheet`, 즉시 PATCH). **퇴근 행 = 상태변경**(`ClockOutStatusSheet`, 상태 라디오 + 퇴근시각 입력 → 수정요청→수락). **휴게 행 = 시간변경**(`BreakChangeSheet`, 휴게 시작·종료 HH:MM 2입력 → 수정요청→수락, 퇴근시각 입력 없음). 휴게/퇴근 편집은 즉시 PATCH가 아닌 수정요청→수락 경로로 통일한다(ADR 0004). **T15: record 없는 날(`record===null`)은 편집 카드 대신 — 미래(`date>todayDate()`)면 "미래 날짜는 추가할 수 없습니다." 안내, 과거/오늘이면 `AddRecordForm`(상태 라디오+출근 필수+퇴근 선택+사유) + 본인 `EditRequestList`(해당 date 필터) — 을 노출하고, 제출 시 `useEditRequests.submit({date, reason, after:{status,clockIn,clockOut}})`(before 미전송) 수정요청 경로를 공유한다. `record≠null` 분기는 불변(AC-2).** |
| **월 급여 요약** (PaySummary) | `{ totalPay, deductMinutes, overtimeCount, overtimeMinutes }`. 불변식: `totalPay = Σ items.amount`(주휴 포함). |
| **사용자 프로필** (UserProfile) | 근무자 개인정보 `{ name, birthDate, phone, email, avatarInitial }`. 이름·생년월일은 본인인증 전 **읽기전용**, 휴대폰·이메일만 편집 가능. |
| **매장 정보** (StoreInfo) | 소속 매장 `{ name, joinDate, employed, workDays, workTime }`. UI 표기 "입사 YYYY.MM.DD ~ 재직중 / 근무 월~금 HH:MM~HH:MM". |
| **읽기전용 필드 정책** | 이름·생년월일 변경은 본인인증(미구현)을 전제로 하며, `PATCH /api/profile`이 화이트리스트(phone/email)로 해당 필드를 무시(200)하여 계약 단일 출처(store)에서 강제한다. 형식 오류(이메일/전화)는 400. |
| **마스터** (master) | 매장 점주 역할. 전체 크루의 근무/휴일을 집계 조회하고 수정요청을 수락할 수 있는 유일한 역할. 본인 근무기록은 없을 수 있음(`MASTER_ID="master-1"`). 집계(`getCrewSummaries`) 대상에서 제외된다. |
| **크루** (crew) | 근무자 역할. 본인 `crewId` 데이터만 조회·생성. 수정요청 생성은 가능하나 수락은 불가. 초대로만 합류(`active=true`). 시드 3명: 김민정(`crew-minjung`) + `crew-2` + `crew-3`. |
| **crewId 스코프** | store/API가 데이터를 사용자별로 격리하는 키. store 내부는 `recordsByCrew: Map<crewId, Map<date, AttendanceRecord>>` / `profilesByCrew`로 분리. 9개 store 함수는 trailing `crewId=DEFAULT_CREW_ID` optional 인자로 받으며, **미지정 시 김민정(`crew-minjung`)으로 fallback**하여 단일사용자 흐름을 보존한다(ADR 0004 append-only 회귀 0 전략 계승). |
| **초대** (Invite) | 마스터가 발급하는 합류 코드 `{ code, createdBy, targetCrewId?, status, createdAt }`. `status: 대기 → 사용`. `createInvite(masterId)`가 혼동문자 제외 6자 코드 발급. `joinByInvite(code, crewId)`: 유효 미사용 → 크루 `active=true`+코드 `사용`(JoinResult); 없는 코드 → `null`(400 의미); 이미 사용된 코드 → `"used"`(409 의미). 만료/회수 미구현(mock). |
| **크루 집계** (CrewSummary) | 마스터 집계 행 `{ crewId, name, avatarInitial, workMinutes, overtimeMinutes, vacationDays }`. `getCrewSummaries(month)`가 크루(role=crew)별 월 합산. 빈 크루/없는 월은 0(NaN 방어). |
| **현재 사용자 전달** (헤더 scope) | 클라이언트가 현재 사용자를 fetch 헤더 `x-crew-id`/`x-role`로 API에 전달한다(`HEADER_CREW_ID`/`HEADER_ROLE`). URL은 불변이라 기존 테스트에 무영향(회귀 0). 헤더 부재 → `role=crew`, `crewId=crew-minjung` 폴백. `readScope(req)`(`src/lib/scope.ts`)가 추출. |
| **읽기 스코프 강제** (enforceReadScope) | `enforceReadScope(scope, requested?)`: **크루는 requested를 무시하고 본인 crewId를 강제**(타인 데이터 노출 0), **마스터는 requested(쿼리 `?crewId=` 또는 헤더) 허용, 없으면 self**. API GET/PATCH(attendance·pay·profile)가 store 호출 전 적용. 수정요청 생성(POST)은 항상 생성자 본인 crewId로 태그. |
| **수락 마스터 게이트** | `POST /api/attendance/requests/approve`는 `readScope(req).role !== "master"` 이면 **403 + store 불변**(`approveRequest` 미호출). UI는 `EditRequestList`의 `canApprove`(=`role==="master"`) prop으로 수락 버튼을 숨긴다. UI 숨김 + API 403 이중 방어. |
| **마스터 수정요청 컨펌** | 마스터가 전체 크루의 `EditRequest`를 `GET /api/master/requests`(마스터 게이트 role≠master→403, `api/master/crews` 게이트 복제)로 조회하고 `POST /api/attendance/requests/approve`로 수락하는 경로. 응답은 `MasterRequestsResponse{requests: MasterRequestRow[]}`로, `listRequests()`(전체 최신순) ⨝ `listCrews()`(crewId→name) **서버 조인**으로 `crewName`(폴백 crewId)을 포함한다(클라 2-fetch 회피, ADR 0006). UI는 `/master` 집계뷰 아래 "수정요청 컨펌" 섹션(`MasterRequestList` presentational, 대기 요청에만 수락 버튼·E-3). 크루는 본인 요청만 조회(403 격리). 수락 시 `req.crewId` 레코드에 `after` 반영·`대기→수락` 전이 후 목록 reload. |
| **홈 토글 스코프** | `ClockToggle`(홈 출퇴근 **상태 카드**)도 `authHeaders(user)` + `crewId`(= `user.crewId ?? user.id`) effect 의존성으로 본인 스코프를 강제한다(FR-1 이전 김민정 폴백 누수 교정). 전환 시 `setRecord(null)` 동기 리셋 + 재fetch로 stale 0(useAttendance 패턴). **T11: 등록 로직은 공용 훅 `useTodayClock(date)`로 추출(단일 진실원)되어 `ClockToggle`·`ClockFab`이 공유.** **T12(AC-1): 홈 `ClockToggle`은 상태 전용으로 전환 — 출근/퇴근/마감 버튼을 제거하고 `useTodayClock`의 `record`/`phase`로 매장명·headline·진행바만 표시한다. 홈에서 clock PATCH(`clockIn`/`clockOut`) 호출 경로 없음(등록은 FAB만). GET 구독은 유지(등록 후 최신 상태 반영).** |
| **출퇴근 등록 FAB** (ClockFab) | `/attendance` 우하단 플로팅 버튼. 홈 `ClockToggle`과 공용 훅(`useTodayClock`)으로 등록 로직(오늘 레코드 phase 인지 `clockPhase` → `nowHHMM` PATCH, `authHeaders` 크루 스코프) 공유. 출퇴근 입력의 **단일 진입점**(홈은 상태만, 날짜 클릭은 상세 보기/수정 유지). phase: before→"출근"/working→"퇴근"/done→비활성 "마감". **T12(AC-3): 출근(clockIn)은 즉시 처리하나, 퇴근(clockOut)은 `window.confirm(clockOutConfirmMessage())`("현재 시각 HH:MM에 퇴근 처리할까요?", `clockFabConfirm.ts` 순수 함수)로 확인 후에만 PATCH하고 취소 시 미처리한다.** `z-40`(BottomNav `z-30` 위·BottomSheet `z-50` 아래), `bottom-28`로 BottomNav 바와 비겹침. client-only + 오늘 날짜 mount-gate(`useSyncExternalStore`, 하이드레이션 안전). 마스터 포함 무조건 노출(`authHeaders` self 스코프). 등록 성공 시 `onRegistered`→`AttendanceCalendarView`가 `reloadKey` 증가 → `MonthlyCalendar`가 현재 월 `useMonthAttendance.reload` 재호출(오늘 셀 반영). |
| **단일일 상세 조회 계약** (`GET /api/attendance/[date]`) | **T12(AC-2): 잘못된 날짜 형식(`isValidDateString` 실패, 예 `2026-05-99`)만 404를 반환하고, 유효한 날짜 형식은 기록 유무와 무관하게 200을 반환한다 — 기록 없음 시 body `null`**(이전 404에서 갱신). 클라(`useTodayClock`/`useDayAttendance`)는 `res.ok ? json : null` 패턴이라 200+null을 record 없음으로 그대로 처리하고, `AttendanceDetail`은 "해당 날짜의 근무기록이 없습니다." 빈 상태를 표시한다. `enforceReadScope`로 크루 본인 강제·마스터 `?crewId=` 허용은 불변. |
| **현재 사용자 컨텍스트** (CurrentUserProvider) | `"use client"` Context. 초기 state는 항상 김민정(`crew-minjung`, role crew) → SSR/CSR 1차 렌더 동일(하이드레이션 mismatch 0). `localStorage`(`crewmon.currentUser`)는 **mount 후 useEffect에서만** 읽어 복원(초기 useState 미참조). `setCurrentUser`가 state+localStorage 갱신. `useCurrentUser()` 소비, `authHeaders(user)` → `{x-crew-id, x-role}`. |
| **역할전환** (RoleSwitcher) | 마이페이지의 mock 계정 전환 UI. `GET /api/crews`(→ `listCrews()`) 목록에서 선택 시 `setCurrentUser`. 전환 시 데이터 훅들이 `crewId`를 effect 의존성으로 두어 재fetch·무효화한다(stale은 active cleanup으로 차단). 마스터 선택 시 마이페이지에 `/master` 진입 링크 노출. |
| **마스터 집계뷰** (MasterView / `/master`) | 마스터 전용 집계 화면. `app/master/page.tsx`(RSC 셸) → `MasterView`(`"use client"`). role 진실원이 클라 컨텍스트(localStorage)라 SSR 가드 불가 → **client 가드**: mount 후(역할 복원 완료) role≠master 면 `router.replace("/")`. **mount 전(role 미확정)에는 섣부른 리다이렉트 금지**(로딩 가드, `useSyncExternalStore` mount 게이트). 월 선택(`MonthSelector` + ‹ › 이동) + `useMasterSummary(month)`(→ `GET /api/master/crews`) → `CrewSummaryList`. 빈 크루/없는 월은 0 graceful(E-5). |
| **크루 집계 행** (CrewSummaryList) | presentational 집계 행 목록. 크루별 근무합계·연장·휴일수(`minutesLabel` 한글 분 라벨, NaN 방어). 크루 0건이면 "집계할 크루가 없습니다." 빈 상태(E-5). |
| **초대 플로우 API** | `POST /api/invites`(마스터 게이트 role≠master→403, 통과 시 `createInvite(crewId)` → 201 `Invite`). `POST /api/invites/join` body`{code, crewId}` → `joinByInvite` → 200 `JoinResult`(크루 active=true) / 없는 코드 400 / 사용된 코드 409. `InvitePanel`(`"use client"`, role 분기: 마스터=생성 버튼+코드 표시 / 크루=코드 입력+합류)이 `useInvites` 훅(authHeaders)으로 호출. 마이페이지에 role별 섹션 노출. |
| **role별 바텀탭** (BottomNav) | 크루 = 기존 4탭(홈/출퇴근/급여/마이페이지). 마스터 = 집계(`/master`) + 마이페이지 2탭(본인 출퇴근/급여 기록 없음 E-4 → 미노출). **하이드레이션 안전**: mount 전(localStorage 역할 복원 전)에는 항상 크루 4탭으로 1차 렌더(SSR/첫CSR 마크업 동일, mismatch 0), mount 후 role=master 면 탭 교체(`useSyncExternalStore` 게이트). |

## 데이터 표기 규칙 (UI)

- 캘린더 배지: 그린 `+N분` = 정규 초과 연장분, `-N분` = 정규 대비 부족분. `+0분`은 숨김(노이즈 제거).
- 휴가일: 일급 0원, 캘린더 `휴가` 라벨.
- 메인 컬러: 코랄/오렌지 `#F26B4D` (1차 액션·강조).
- 아이콘 버튼 규격: 아이콘 전용(텍스트 없는) **클릭 가능** 버튼의 터치 타겟은 32×32(`grid h-8 w-8 place-items-center leading-none` + 중앙정렬)로 통일. 대상은 월/일자 네비 `‹ ›`·뒤로 `‹`·프로필 `📷`. 비클릭 장식 span(`🔔`/`⤓`)·텍스트 버튼(상태변경/수락/급여명세서 등)은 대상 아님(FR-3, ADR 0006).

## 시드 불변식 (자의적 구성 금지 — `src/lib/seed.test.ts`가 강제)

1. 급여차감시간 월 합계 = **440분**
2. 연장 **6회**, 연장 월 합계 = **544분**(9시간4분)
3. `totalPay = Σ items.amount` (주휴수당 67,080원 1건 포함)

이미지의 일별 배지 액면값이 위 summary 제약과 충돌하면 **summary 제약이 우선**한다(배지는 표기일 뿐).

## 운영 메모

- 백엔드: Next.js Route Handler + **인메모리 store**(외부 DB·인증 없음). 서버 재시작 시 시드로 초기화 — 명세된 동작이며 버그 아님.
- 데이터 페칭: 전 라우트 client fetch + `cache:'no-store'`(인메모리 진실원과 일치).
