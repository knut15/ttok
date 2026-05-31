# 03-architecture — 편집 시트 재구성 + 범위형 휴게 (T7)

- **작성**: task-architect
- **대상 PRD**: `01-prd.md` (v1)
- **승인**: `02-approval.md` — APPROVE (Q1 범위형 / Q2 출근 현행 / Q3 수정요청 수락)
- **detected_stack**: `react-nextjs` (next 16.2.6, App Router, 인메모리 store)
- **버전**: v1
- **전제 정정**: 승인이 PRD §11 Q-1 가정(분 단위)을 **범위형(HH:MM~HH:MM)** 으로 뒤집음. 따라서 AC-1/AC-2/AC-5 및 §6 계약을 본 설계서가 범위형으로 **재해석**한다(아래 §0).

---

## §0. 승인 함의 — 범위형 휴게 저장 결정 (설계 핵심)

승인 §"범위형 선택의 아키텍처 함의"에 따라, 휴게를 **레코드가 보유한 시작~종료 시각**으로 승격한다.
현재: `AttendanceRecord.breakMinutes`(분)만 저장, 범위 `11:30~12:00`은 `DEFAULT_BREAK_RANGE` **표시 상수**(레코드에 없음).

### 저장 방식 택1 비교

| 안 | 저장 필드 | breakMinutes | 장점 | 단점 | 판정 |
|---|---|---|---|---|---|
| A | `breakStart?` + `breakEnd?` (HH:MM) | 파생 캐시(저장 유지) | 범위 편집/표시 정합, breakMinutes 기존 소비처(seed/pay/store) 무수정 | 이중 저장(범위+분) 정합 책임 | **채택** |
| B | `breakStart?` 만 + duration 파생 | 파생 | 필드 1개 | 종료시각 표현 불가 → 범위 표시 불가 (디자인 위배) | 기각 |
| C | `breakStart?`+`breakEnd?`, breakMinutes 제거 | 제거(전면 파생) | 단일 진실원 | breakMinutes 소비처(PayDetail/seed/calcWorkMinutes/결근휴가 0세팅) 전면 개수 → append-only 위배·122 회귀 위험 | 기각 |

**채택: 안 A.** 근거:
1. **append-only**: `breakStart?`/`breakEnd?` 는 optional 추가, `breakMinutes`(number, 기존 필수)는 그대로 보존 → 기존 소비처(seed/pay/store/PayDetail) 시그니처 불변.
2. **단일 파생 규칙**: `breakStart`+`breakEnd` 둘 다 있으면 `breakMinutes = max(0, parseHHMM(breakEnd) − parseHHMM(breakStart))`. 하나라도 없으면 기존 `breakMinutes` 그대로(하위호환).
3. **회귀 0**: 시드 근무일에 `breakStart="11:30"`, `breakEnd="12:00"` 부여 → 파생 30분 = 기존 `DEFAULT_BREAK_MINUTES`(30). seed 불변식 ①440 ②6회544 ③totalPay 전부 입력 불변(아래 §3.4 증명).

### EditRequest.after 휴게 담는 방식
`EditRequestChange.after` 에 **`breakStart?`/`breakEnd?`(HH:MM, optional append)** 를 담는다(breakMinutes 직접 X — 범위가 진실원이므로 분은 서버 파생). before/after 공용 타입이므로 양쪽에 동일 optional 필드가 생긴다. 미명시 요청은 기존과 100% 동일 동작(멱등).

---

## §1. 변경 범위 & 모듈 경계

### 신규/수정 파일 (한 줄 책임)

| 파일 | 신규/수정 | 단일 책임 | 경계(RSC/client) |
|---|---|---|---|
| `src/types/index.ts` | 수정 | `AttendanceRecord`·`EditRequestChange` 에 `breakStart?`/`breakEnd?` optional append (계약 단일 출처, leaf) | 무관(타입) |
| `src/lib/time.ts` | 수정 | 순수 헬퍼 `calcBreakMinutes({breakStart, breakEnd})` 추가 — 범위→분 파생, 음수/역전/NaN 방어 | server-safe 순수함수 |
| `src/lib/store.ts` | 수정 | `recalcClockFields`(범위→분 반영 + R1 해소), `approveRequest`(after.break 범위 반영), `addRequest`(before 스냅샷에 범위 포함) | server-only |
| `src/lib/seed.ts` | 수정 | 근무일 시드에 `breakStart="11:30"`/`breakEnd="12:00"` 부여(휴가일 제외). 파생 30분 = 기존값 | server-only |
| `src/lib/constants.ts` | 무수정(재사용) | `DEFAULT_BREAK_RANGE`/`DEFAULT_BREAK_MINUTES` 그대로 사용 | — |
| `src/app/api/attendance/requests/route.ts` | 수정 | POST 검증에 "after.breakStart/breakEnd 존재 시 HH:MM 형식·역전 검증" 분기 append | server (Route Handler) |
| `src/app/api/attendance/requests/approve/route.ts` | 무수정 | body{id}→approveRequest 위임 그대로 (store 가 범위 반영 담당) | server |
| `src/features/attendance/components/BreakChangeSheet.tsx` | **신규** | 휴게 범위(시작~종료 HH:MM 2입력) 편집 시트. onApply→draft.break 갱신. clockOut 입력 **부재** | `"use client"` |
| `src/features/attendance/components/ClockOutStatusSheet.tsx` | **신규** | 퇴근 행 시트 = 상태 라디오 5종 + 퇴근시각(clockOut) 입력. onApply→draft 갱신 | `"use client"` |
| `src/features/attendance/components/AttendanceDetail.tsx` | 수정 | `TimeChangeSheet` 제거. 휴게 행→`BreakChangeSheet`, 퇴근 행→`ClockOutStatusSheet`, 출근 행→현행 `StatusChangeSheet`(즉시 PATCH) 유지. break/clockOut draft 수집→after 제출 | `"use client"` |
| `src/features/attendance/components/StatusChangeSheet.tsx` | 무수정 | 출근 행 즉시 상태변경 시트 — 시그니처 불변(§4.4 분석) | `"use client"` |
| `src/features/attendance/components/EditRequestList.tsx` | 무수정(선택) | 휴게 범위 표시는 후속 — 본 task 범위 외(필요 시 §4.4 비침습 추가만) | RSC-safe presentational |
| `CONTEXT.md` | 수정 | 휴게=범위 저장·파생 1줄, 시트 의미 2줄, EditRequest.after 휴게 범위 1줄 | 문서 |
| `docs/adr/0004-edit-sheet-roles-and-break-edit.md` | **신규** | 결정① 수정요청 경로 통일 ② 범위형 휴게 채택(분 파생) | 문서 |

### 모듈 의존성 방향 (단방향 강제)
```
types (leaf, 무의존)
  ↑                ↑
time(순수)      constants
  ↑                ↑
store(server-only) ← seed
  ↑
Route Handler (api/.../requests, approve)
  ↑  (fetch only, 직접 import 금지)
hooks(useAttendance) → components(AttendanceDetail → Break/ClockOut/Status Sheet)
```
- client 컴포넌트는 store 직접 import 금지(현행 유지) — 반드시 hooks→fetch→Route Handler 경유.
- `calcBreakMinutes` 는 `time.ts`(순수, store 비의존)에 둠 → store 와 api 양쪽이 동일 출처 사용(DRY).

### append-only 확인
- `AttendanceRecord`: `breakStart?`/`breakEnd?` 추가만, 기존 8필드 불변.
- `EditRequestChange`: `breakStart?`/`breakEnd?` 추가만, 기존 3필드(status/clockIn/clockOut) 불변.
- `seed.ts`: 기존 row 의 workMinutes/overtime/deduct 불변, 범위 2필드만 추가.

### AC 매핑 (각 AC ↔ 모듈)
| AC | 모듈/결정 |
|---|---|
| AC-1 (휴게 시트 clockOut 부재 + 범위입력) | §1 `BreakChangeSheet`(신규), §4.2 |
| AC-2 (after.break 범위 담김, clockIn/clockOut 불변) | §2.3 휴게 흐름, §2.1 타입 |
| AC-3 (수락→breakMinutes 파생 반영 + work 재계산) | §2.5 `recalcClockFields`, §3.2 |
| AC-4 (퇴근 시트 상태+clockOut 입력) | §1 `ClockOutStatusSheet`(신규), §4.2 |
| AC-5 (after{status,clockIn불변,clockOut}, 수정요청) | §2.4 퇴근 흐름 |
| AC-6 (수락→clockOut+overtime+work 재계산) | §2.5, ADR 0003 `calcOvertimeByClock` |
| AC-7 (break optional, 미명시 멱등) | §2.1, §2.6 R1, §3.4 |
| AC-8 (clockIn 불변) | §2.3/§2.4 after.clockIn=record.clockIn 고정 |

---

## §2. 데이터 흐름 & 계약

### 2.1 타입 확장 (append-only)
```typescript
// src/types/index.ts
export interface AttendanceRecord {
  date: string;
  status: WorkStatus;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;       // (기존, 필수) 휴게 분 — 범위 있으면 파생 캐시
  breakStart?: string;        // 신규 optional "HH:MM" 휴게 시작
  breakEnd?: string;          // 신규 optional "HH:MM" 휴게 종료
  workMinutes: number;
  overtimeMinutes: number;
  deductMinutes: number;
}

export interface EditRequestChange {
  status: WorkStatus;
  clockIn: string | null;
  clockOut: string | null;
  breakStart?: string;        // 신규 optional — 휴게 범위 편집 시에만 포함
  breakEnd?: string;          // 신규 optional
}
```

### 2.2 휴게 범위 파생 계약 (time.ts 순수 함수)
```typescript
// src/lib/time.ts — 순수, store 비의존
// 둘 다 유효 HH:MM 이고 end>start → 분, 아니면 fallback(호출부 기존 breakMinutes)
export function calcBreakMinutes(i: {
  breakStart?: string | null;
  breakEnd?: string | null;
  fallback: number;
}): number {
  if (!i.breakStart || !i.breakEnd) return i.fallback;
  const s = parseHHMM(i.breakStart);
  const e = parseHHMM(i.breakEnd);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return i.fallback;
  return e - s;  // max 불요(e>s 보장). 음수/역전은 fallback 으로 흡수
}
```

### 2.3 휴게 변경 흐름 (AC-1,2,3,7,8)
```
[BreakChangeSheet] 시작/종료 HH:MM 2입력 (clockOut 입력 없음)
  → onApply({breakStart, breakEnd})  → AttendanceDetail breakDraft 갱신
  → EditRequestForm 제출 → useEditRequests.submit
  → POST /api/attendance/requests
     after = {
       status: record.status,
       clockIn: record.clockIn,    // 불변 (AC-8)
       clockOut: record.clockOut,  // 불변
       breakStart, breakEnd        // 신규 범위
     }
  → addRequest: before 스냅샷에 record.breakStart/breakEnd/status/clock 포함
  → (수락) POST /requests/approve → approveRequest → recalcClockFields(범위→분→work)
```

### 2.4 퇴근 변경 흐름 (AC-4,5,6,8)
```
[ClockOutStatusSheet] 상태 라디오 5종 + clockOut HH:MM 입력
  → onApply({status, clockOut}) → AttendanceDetail clockOutDraft/statusDraft 갱신
  → EditRequestForm 제출
  → POST /requests  after = {
       status: 선택상태,
       clockIn: record.clockIn,    // 불변 (AC-8)
       clockOut: 입력값,
       (break 미명시 → 기존 휴게 유지)
     }
  → (수락) approveRequest → recalcClockFields(clockOut→work, calcOvertimeByClock→overtime)
```
> 출근 행은 `StatusChangeSheet`→`changeStatus`(즉시 PATCH) **현행 유지**(Q2). 흐름 분리.

### 2.5 재계산 흐름 (store.recalcClockFields)
- 입력: merged 레코드(after 반영 후). break 범위가 있으면 → `calcBreakMinutes` → breakMinutes 갱신 → `calcWorkMinutes`.
- clockOut 변경 → `calcOvertimeByClock({clockOut})`(ADR 0003, 15:00=900 기준) → overtimeMinutes.
- clockIn 은 어느 경로든 after.clockIn=record.clockIn 로 들어오므로 불변(AC-8).

### 2.6 R1 해소 — break "미명시(undefined)" vs "명시(범위 있음)" 구분
**현 결함**: `recalcClockFields` 의 `rec.breakMinutes === 0 ? DEFAULT_BREAK_MINUTES : rec.breakMinutes` 가 "휴게 0"을 무조건 30으로 복원 → 명시적 휴게 없음(0) 의도가 흡수됨.

**범위형에서의 해소 규칙** (우선순위):
1. `breakStart`+`breakEnd` **둘 다 명시** → `breakMinutes = calcBreakMinutes(...)` (파생값 절대 존중. 0이어도 0). 복원 로직 **건너뜀**.
2. 범위 **미명시** + `breakMinutes > 0` → 기존 breakMinutes 그대로.
3. 범위 미명시 + `breakMinutes === 0` → 기존 호환 위해 `DEFAULT_BREAK_MINUTES` 복원 유지 (휴가/결근 역전환 시 휴게 복원 보존 — updateStatus 분기 호환).

즉 **범위가 진실원으로 명시된 경우에만** `=== 0` 복원을 우회한다. 범위 미명시 레거시 경로는 기존 동작 100% 보존 → 122 회귀 0. (E-3 명시 휴게 0: 범위를 동일 시각으로 입력 시 end<=start → calcBreakMinutes fallback. 휴게 0 의도는 "범위 비움 + breakMinutes 0 명시"가 아닌 범위형 UX 상 표현 불가 → Non-goal E-3 은 범위형에선 "역전/동일 입력 시 적용 비활성"으로 흡수. §3.1 참조.)

### 2.7 경계면 일치 검증 (FE ↔ API ↔ store)
| 경계 | FE 송신 | API 검증 | store 소비 | 일치 |
|---|---|---|---|---|
| break 범위 | `after.breakStart/End: "HH:MM"` | 존재 시 parseHHMM NaN→400, end<=start→400 | calcBreakMinutes→breakMinutes | ✅ |
| clockOut | `after.clockOut: "HH:MM"\|null` | 기존 NaN→400 (불변) | calcWorkMinutes/Overtime | ✅ |
| clockIn | `after.clockIn = record.clockIn` | 기존 검증 불변 | merged 그대로 → 불변 | ✅ |
| break 미명시 | after 에 break 키 부재 | 검증 스킵(분기 진입 안 함) | fallback=기존 breakMinutes | ✅ 멱등 |

---

## §3. 알고리즘 & 클린코드 사전 점검

### 3.1 휴게 분 파생 — `calcBreakMinutes` (시간복잡도 O(1))
- `parseHHMM(end) − parseHHMM(start)`: 정규식 1회+산술, 루프 없음 → **O(1)**.
- 방어: NaN(형식불량) / `end <= start`(역전·동일) → fallback. 음수 발생 불가(가드가 선차단).
- 시트 '적용' 활성 조건: 두 입력 모두 유효 HH:MM **AND** `parseHHMM(end) > parseHHMM(start)` → 역전/동일 시 비활성(E-2/E-5 흡수, §4.2).

### 3.2 recalcClockFields 갱신 의사코드 (범위 반영 + R1)
```
function recalcClockFields(rec):
  if rec.clockIn and rec.clockOut:
    if rec.breakStart and rec.breakEnd:           # 범위 명시 → 진실원 (R1 case1)
      breakMin = calcBreakMinutes(start,end,fallback=rec.breakMinutes)
    elif rec.breakMinutes == 0:                   # 레거시 복원 (R1 case3)
      breakMin = DEFAULT_BREAK_MINUTES
    else:                                          # 기존 분 (R1 case2)
      breakMin = rec.breakMinutes
    work = calcWorkMinutes(clockIn, clockOut, breakMin)   # O(1)
    return {...rec, breakMinutes: breakMin, workMinutes: work,
            overtimeMinutes: calcOvertimeByClock(clockOut)}
  return {...rec, workMinutes: 0, overtimeMinutes: 0}      # clock 한쪽 null (E-6)
```
- 전체 **O(1)** (분기+산술, 루프 없음). 중첩 깊이 ≤ 3 (if→if/elif/else→산술). 함수 길이 ≤ 30줄.

### 3.3 휴게 > 근무 span 하한 (E-1)
- `calcWorkMinutes` 의 `Math.max(0, end−start−break)` 이미 0 하한 보장. 범위형 추가 변경 없음. work=0 정상 수락.

### 3.4 seed 불변식·122 회귀 0 증명
- 시드 근무일 `breakStart="11:30"`/`breakEnd="12:00"` → `calcBreakMinutes = parseHHMM("12:00") − parseHHMM("11:30") = 720 − 690 = 30` = 기존 `breakMinutes`(DEFAULT 30).
- 따라서 seed `workMinutes`(390/424/…), `overtimeMinutes`, `deductMinutes` 입력 **전부 불변** → seed.test ①440(deduct Σ) ②6회544(overtime) ③totalPay(Σitems) **불변**.
- 5/28(07:58~15:00, 422−30=392) 도 break 30 불변 → workMinutes 392, amount 67424 불변.
- 휴가일(29일): breakStart/breakEnd 미부여(범위 없음) → breakMinutes 0 유지(`status==="휴가" ? 0`) → 기존 동일.
- 범위 미명시 EditRequest 수락(AC-7): 범위 키 부재 → R1 case2/3 = 기존 분기 = 기존 결과. 멱등 보존.
- **순환복잡도**: 신규 분기는 store.test 의 break=0 복원 테스트가 통과하도록 case3 보존. 신규 case1 만 추가 경로.

### 3.5 네이밍/패턴 컨벤션 (CLAUDE.md/CONTEXT.md 우선)
- 도메인 용어는 CONTEXT.md 캐논 준수: breakMinutes(분), 범위는 HH:MM 문자열.
- 신규 함수 `calcBreakMinutes` 는 기존 `calcWorkMinutes`/`calcOvertimeByClock` 명명 패턴 일치.
- 시트 컴포넌트 명명: 기존 `StatusChangeSheet` 패턴 → `BreakChangeSheet`/`ClockOutStatusSheet`.

---

## §4. 렌더링 & 성능 정책 (react-nextjs)

### 4.1 컴포넌트 경계
- `BreakChangeSheet`/`ClockOutStatusSheet`: **`"use client"`** (useState·onChange 입력 보유, BottomSheet 재사용).
- `AttendanceDetail`: 기존 `"use client"` 유지. 상세는 동적 `[date]` 라우트 → SSG/하이드레이션 정합 무관.
- store/Route Handler: server-only. fetch 는 전부 `cache: "no-store"`(인메모리 진실원과 일치, CONTEXT.md 운영메모) — 범위형 추가도 동일 정책, 신규 캐시 도입 없음.

### 4.2 시트 UI 정책
- `BreakChangeSheet`: `type="time"` 입력 2개(시작/종료). clockOut 입력 **없음**(AC-1). 적용 활성 = 둘 다 유효 HH:MM AND end>start.
- `ClockOutStatusSheet`: 상태 라디오 5종(`WORK_STATUSES`) + `type="time"` clockOut 1개(AC-4). 적용 활성 = clockOut 빈값 또는 parseHHMM 유효.
- 열릴 때 `key` remount 로 draft 초기화(현행 `TimeChangeSheet` 패턴 계승, effect 불필요).

### 4.3 메모이제이션/effect
- 신규 effect 도입 없음. 입력 상태는 시트 로컬 useState. AttendanceDetail 의 렌더 중 draft 동기화 패턴(syncKey) 유지 — break draft 도 동일 패턴으로 동기화(별도 effect 금지).
- 수락 후 `reloadDay()` 로 record 재fetch(현행) → 범위/분 갱신 반영.

### 4.4 시그니처 영향 분석
- `StatusChangeSheet`: 출근 행 전용으로 **시그니처 불변**(open/current/onClose/onChange). 퇴근 행은 신규 `ClockOutStatusSheet` 사용 → 기존 시트 재사용 안 함(혼선 방지). 단 props 형태 유사.
- `AppHeader`: 본 task 비관여(영향 없음).
- `EditRequestList`: `req.after` 표시에 휴게 범위 추가는 **선택** — 추가 시에도 optional 필드 읽기만(`req.after.breakStart`) → 비침습. 본 task 범위에선 미변경 권장.

---

## 📊 정규식 자가 검증 결과

(detected_stack = react-nextjs, 4섹션 본문 대상 grep 실행)

- §1 파일 경로 패턴 `\.(tsx?|...)`: ✅ 다수 매치 (`src/types/index.ts`, `BreakChangeSheet.tsx`, `ClockOutStatusSheet.tsx`, `src/lib/store.ts` 등)
- §2 타입/계약 코드 블록 ` ```typescript `: ✅ 2개 매치 (2.1 타입 확장, 2.2 calcBreakMinutes)
- §3 시간복잡도 `O(...)`: ✅ 다수 매치 (O(1) — 3.1/3.2/3.3)
- §4 Next.js 렌더링 키워드: ✅ 매치 (`"use client"`, `no-store`, SSG, 하이드레이션, 메모이제이션, effect)

자가 PASS — FAIL/바이패스 없음.

---

## 자체 체크리스트 결과

- §1 모듈 경계 분리됨: ✅ (시트 신규 분리, store/api/types 단방향 의존, append-only)
- §2 경계면 타입 일치: ✅ (FE↔API↔store break 범위/clock 일치표 §2.7)
- §3 시간복잡도 명시: ✅ (calcBreakMinutes/recalcClockFields O(1), seed 불변식 증명)
- §4 렌더링 정책 명시: ✅ ("use client" 경계, no-store, 시트 UI, effect 금지)

승인 함의 체크리스트:
- [x] append-only (record/EditRequest/seed 기존 불변)
- [x] 범위형 휴게 저장·표시 정합 (안 A, breakStart/breakEnd + 파생 breakMinutes)
- [x] R1 (break undefined vs 명시) 해소 (§2.6 3-case 우선순위)
- [x] approve 재계산 (break 범위→분→work + clockOut→overtime)
- [x] seed 불변식·122 회귀 0 증명 (§3.4: 11:30~12:00=30 파생)
- [x] 출근 현행·clockIn 불변 (Q2, after.clockIn=record.clockIn)
- [x] RSC/client 경계 (시트 client, store server-only, no-store)

---

## developer 인계 요약 (핵심 설계 결정)

1. **휴게 = 범위 저장(안 A)**: `AttendanceRecord`/`EditRequestChange` 에 `breakStart?`/`breakEnd?`(HH:MM) optional append. `breakMinutes`(분)는 보존하되 범위 있으면 `calcBreakMinutes`(time.ts 신규, O(1)) 파생 캐시. breakMinutes 직접 편집 X.
2. **회귀 0 키**: 시드 근무일에 `"11:30"`/`"12:00"` 부여 → 파생 30분 = 기존값. seed 불변식 ①440 ②6회544 ③totalPay 와 122 테스트 전부 입력 불변. 휴가일은 범위 미부여(0 유지).
3. **R1 해소(§2.6)**: `recalcClockFields` 에서 우선순위 — ① 범위 둘 다 명시 → 파생값 절대 존중(0도 0), ② 범위 없음+breakMinutes>0 → 기존, ③ 범위 없음+breakMinutes===0 → DEFAULT 복원(레거시·휴가역전환 호환). 범위 명시일 때만 `===0` 복원 우회.
4. **clockIn 불변(AC-8)**: 휴게/퇴근 어느 경로든 `after.clockIn = record.clockIn` 고정. 출근 행은 `StatusChangeSheet` 즉시 PATCH 현행 유지(Q2) — 손대지 말 것.
5. **시트 분리**: 휴게 행→신규 `BreakChangeSheet`(범위 2입력, clockOut 입력 절대 없음), 퇴근 행→신규 `ClockOutStatusSheet`(상태 라디오+clockOut). 기존 `TimeChangeSheet` 제거. 둘 다 수정요청→수락 경로(즉시 PATCH 신설 금지, Q3).
