# 🏛 아키텍처 설계서 (v1) — 크루 출근 격리 + 마스터 수정요청 컨펌 + 아이콘 버튼 통일

- **Task**: 2026-06-01-crew-clock-master-confirm / task-architect / detected_stack: react-nextjs
- **확정**: Q1=/master 섹션, Q2=ClockToggle in-place, Q3=className, Q4=클릭버튼만
- **제약**: 186 회귀 0, 크루 본인스코프·마스터 게이트 유지, 하이드레이션 안전, append-only

## §1. 변경 범위 & 모듈 경계
### FR-1 크루 출근 격리 (S1)
- **수정** `src/features/attendance/components/ClockToggle.tsx`(client): `useCurrentUser`/`authHeaders` import, `crewId=user.crewId??user.id`. GET `/api/attendance/[date]`·PATCH `/api/attendance?date=` 에 `headers: authHeaders(user)` spread. GET effect dep `[date]`→`[date,crewId]` + `setRecord(null)` 동기 리셋(useDayAttendance 패턴). 신규 파일 없음, URL/body 불변(회귀 0).
- **추가** `attendance/route.test.ts`(S2): 크루별 격리 통합테스트(`__resetStore`, `x-crew-id`). 서버 무변경.

### FR-2 마스터 수정요청 컨펌 (S3,S4)
- **신규** `src/app/api/master/requests/route.ts`(+test): `api/master/crews` 게이트 복제(role!=='master'→403). `listRequests()`(전체) ⨝ `listCrews()` 서버 조인 → crewName.
- **신규** `src/features/accounts/hooks/useMasterRequests.ts`(client): fetch + approve(기존 approve API 재사용) + reload. `useMasterSummary` 패턴.
- **신규** `src/features/accounts/components/MasterRequestList.tsx`(presentational): 크루명 + 대기배지 + 수락버튼.
- **수정** `src/features/accounts/components/MasterView.tsx`: 집계뷰 아래 "수정요청 컨펌" 섹션 append(마스터 가드 하위).
- store 신규 함수 불필요(listRequests/listCrews/approveRequest 재사용).

### FR-3 아이콘 버튼 32×32 (S5, 클릭버튼만)
공용 `STD="grid h-8 w-8 place-items-center leading-none"` in-place 교체. 확정 12개:
| 파일 | 버튼 |
|---|---|
| `AttendanceCalendarView.tsx` | ‹ › 월네비 (2) |
| `PayView.tsx` | ‹ › (2) |
| `MasterView.tsx` | ‹ › (2) |
| `MasterCrewDetail.tsx` | ‹ › (2) |
| `AttendanceDetailNav.tsx` | ‹ 뒤로 + ‹ › 일자 (3) |
| `BackButton.tsx` | ‹ 뒤로 (1) |
- `ProfileForm.tsx` 📷 = 이미 32×32(검증만). `⤓`/`🔔` 장식 span·텍스트 버튼(수락/상태변경/MonthSelector 등) = 변경 금지.

### 의존성 방향
`types ← scope ← route ← (HTTP) ← hooks ← components`. client는 store 직접 import 금지(route 경유). MasterRequestList(presentational)→types만.

## §2. 데이터 흐름 & 계약
### FR-1
ClockToggle GET/PATCH에 authHeaders(user) → 크루별 스코프. 헤더 부착만(URL/body/응답 불변 → 회귀 0, 폴백 김민정 보존). crewId effect dep로 전환 시 record 리셋+재fetch(stale 0).

### FR-2 신규 API `GET /api/master/requests`
types append (leaf):
```typescript
export interface MasterRequestRow extends EditRequest {
  crewName: string; // listCrews() crewId→name 조인 (폴백 crewId)
}
export interface MasterRequestsResponse {
  requests: MasterRequestRow[]; // listRequests 최신순 계승
}
```
흐름: MasterView(마스터 가드) → useMasterRequests GET(+authHeaders master) [route: role!=='master'→403] → listRequests()⨝listCrews() → MasterRequestList. onApprove(id) → POST /api/attendance/requests/approve {id}(마스터 게이트) → approveRequest(req.crewId 반영, 대기→수락) → reload. crewName=서버 조인(클라 2-fetch 회피).

### 경계면
store `listRequests():EditRequest[]` ↔ route `MasterRequestRow[]` ↔ hook `MasterRequestsResponse` ↔ MasterRequestList props(crewName만 파생 추가). approve는 useEditRequests.approve와 동일 계약 재사용. 기존 GET /requests(크루 본인)·게이트·폴백 불변(회귀 0).

## §3. 알고리즘 & 복잡도
- FR-1 ClockToggle GET/PATCH O(1). 
- FR-2 `/api/master/requests`: listRequests O(R log R) + `Map<id,name>`(listCrews O(C)) + map O(R) = **O(R log R + C)**. 중첩 O(R·C) 회피(Map). approve find O(R) 멱등.
- O(n²) 없음. 중첩≤2, 함수≤50줄. 네이밍 Master*/useMaster*/api/master/* 컨벤션 계승.

## §4. 렌더링 & 권한
- ClockToggle CSR, no-store, HomeToday mount-gate 하위(하이드레이션 0). effect `[date,crewId]` + setRecord(null) 리셋.
- MasterView/MasterRequestList CSR, mount-gate 마스터 가드 하위 섹션 append. useMasterRequests no-store, dep `[crewId,user.role]`. 크루 403(API)+가드 리다이렉트(UI) 이중.
- 전 라우트 no-store(기존). FR-3 정적 className(SSR/CSR 동일, mismatch 0). `grid h-8 w-8 place-items-center leading-none`로 기존 flex 정렬 보존.

## 체크리스트
- [x] FR-1 격리(authHeaders+dep) 회귀0 [x] FR-2 전체조회+게이트+크루명(서버조인) [x] 수락 기존 API 재사용 [x] FR-3 클릭 12개만, 텍스트/장식 불변 [x] 크루403 이중 [x] append-only·186 회귀0 [x] RSC/client

## developer 인계
1. FR-1: ClockToggle in-place(authHeaders GET/PATCH, dep `[date,crewId]`+setRecord(null)). 서버 무변경. 격리 통합테스트.
2. FR-2: 신규 GET /api/master/requests(게이트 복제, 서버 조인) + useMasterRequests + MasterRequestList + MasterView 섹션. 수락=기존 approve API 재사용(store 신규함수 0).
3. 권한/회귀: 크루 403+가드 이중. 게이트·본인스코프·폴백·mount-gate 불변. types append-only.
4. FR-3: 클릭 12개만 `grid h-8 w-8 place-items-center leading-none`. 📷 검증만, ⤓/🔔/텍스트버튼 변경 금지. grep 누락0.
5. CONTEXT.md 용어 3건 + ADR `0006-master-edit-request-confirm.md`(0005 이미 존재 → 0006, 결정①신규라우트 ②서버조인).
