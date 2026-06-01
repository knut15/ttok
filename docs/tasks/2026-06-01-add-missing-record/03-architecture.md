# 03-architecture — T15 과거 누락 근무기록 추가

- detected_stack react-nextjs / feature-based / append-only / 206 회귀 0
- 확정: Q1 빈날짜상세 / Q2 퇴근선택(null 허용) / Q3 미래거부 / Q4 추가·수정 경량라벨 / Q5 clock역전400 / Q6 누적

## §1 변경 범위
| 종류 | 파일 | 책임 |
|---|---|---|
| 신규 | `src/features/attendance/components/AddRecordForm.tsx` | client 추가 폼: 상태 라디오(기본 정상)+출근(필수 HH:MM)+퇴근(선택 null)+사유. 로컬 검증(출근 필수·clock 역전 시 버튼 비활성) 후 onSubmit. store/fetch 비접근 |
| 수정 | `src/features/attendance/components/AttendanceDetail.tsx` | record=null 분기 교체: `date>todayDate()`→미래 안내(폼 미노출, Q3), 과거/오늘→AddRecordForm + EditRequestList(해당일). record≠null 분기 **불변**(AC-2) |
| 수정 | `src/app/api/attendance/requests/route.ts` | POST에 Q5 clock 역전 검증 1블록 추가(clockIn·clockOut 둘다 non-null & parseHHMM(out)≤parseHHMM(in)→400). 미래 날짜 서버 방어(date>todayDate()→400) 선택. 기존 검증 불변 |
| 수정(경량 Q4) | `EditRequestList.tsx`, `src/features/accounts/components/MasterRequestList.tsx` | before 빈(`clockIn===null&&clockOut===null&&status==="정상"`)=추가 라벨. props/타입 불변 |
| 무변경 | `store.ts`(addRequest 빈 before 자동/approveRequest upsert), `useAttendance.ts`(useEditRequests.submit), `EditRequestForm`, parseHHMM/todayDate | 재사용 |

의존성: AttendanceDetail → AddRecordForm/useEditRequests.submit → POST → store.addRequest(무변경). 마스터: MasterRequestList → approve → approveRequest upsert(무변경). 단방향.

## §2 데이터 흐름 & 계약
빈날짜 상세 → AddRecordForm 입력{status,clockIn,clockOut(null 허용)} + 사유 → useEditRequests.submit(before 미전송) → POST /api/attendance/requests(x-crew-id, 형식·status·**Q5역전**·휴게·빈사유 검증) → addRequest(before 빈 자동, crewId 태그) → 201 대기 → EditRequestList 본인 표시. 마스터 MasterRequestList 수락 → approveRequest(records.get??newRecordFrom upsert) → 레코드 생성 → 캘린더/급여 반영.
- 제출 body: `{date, reason, after:{status,clockIn,clockOut}}` (clockOut null 허용, before 부재).
- EditRequestChange 타입 무변경(clockOut: string|null 이미 지원).
- 회귀 0: Q5 진입가드(둘다 non-null)라 기존 휴게/clockOut-null 요청 미진입.

## §3 알고리즘·복잡도
Q5 역전 O(1)(parseHHMM 2회+비교), 미래 비교 O(1)(YYYY-MM-DD 사전식), addRequest O(1), approveRequest O(N) find(기존 계승). O(n²) 없음.
의사코드: `if after.clockIn!=null && after.clockOut!=null && parseHHMM(clockOut)<=parseHHMM(clockIn): 400`.

## §4 렌더링·권한
AddRecordForm client(AttendanceDetail record=null 하위 조건부). 미래(date>todayDate()) 폼 미마운트 + 안내, 서버 400 이중. no-store. submit 후 reload로 요청내역 갱신. 권한: record=null+본인 crewId(readScope)로 크루 본인 격리, 마스터는 추가 폼 무관(수락 403 게이트만).

## 체크리스트
- [x] 빈날짜 추가폼(크루,미래거부) [x] submit EditRequest 재사용 [x] Q5 역전400(진입가드 회귀0) [x] approveRequest upsert 무변경 [x] 추가/수정 라벨 [x] 크루스코프·마스터게이트 [x] 206 회귀0·append-only

## developer 인계
1. 신규 AddRecordForm(client) + AttendanceDetail record=null 분기 교체(미래 폼 미노출). 제출=useEditRequests.submit 재사용(before 미전송→store 빈 자동).
2. route.ts POST Q5 역전 1블록 추가(둘다 non-null 가드=회귀0 핵심). store 코드 변경 0.
3. Q4 라벨: before 빈 파생→"추가" 표시(EditRequestList/MasterRequestList), 타입 불변.
4. 회귀 0: 206 통과 + S3 통합테스트(빈날짜 추가→마스터 수락→upsert 생성+월조회 반영) + Q5 역전400 신규(clockOut-null·휴게 미영향). append-only.
