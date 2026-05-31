# 📋 Task Board — 계정/권한 분리 마스터·크루 (T8)

> teammate / 기존 repo 대규모 확장 / feature-based

## 범위 (사용자 결정)
- **인증**: 데모 역할 전환(mock) — 로그인 없이 mock 계정(마스터 1 + 크루 N) + 상단 사용자/역할 전환.
- **데이터**: 멀티 크루 2~3명 mock 시드(각자 근무기록/스케줄), 마스터 1명.
- **전체 4요구**:
  1. 마스터 = 전체 크루 근무/휴일 조회 (마스터 전용 집계 뷰)
  2. 크루 = 초대로만 합류 (초대 코드/링크 mock 플로우)
  3. 크루 = 본인 스케줄만 조회 (현재 사용자 크루로 스코프)
  4. 변경 컨펌(수락) = 마스터만 (EditRequestList 수락 버튼 마스터 전용 게이트)

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 1 기획 | planner | ✅ 완료 | `01-prd.md` (AC 19+5, sub-task 8) |
| 2 승인 | (user gate) | ✅ APPROVE | `02-approval.md` (B/C/E + 내부 A/D) |
| 2.5 아키텍처 | architect | ✅ 완료 | `03-architecture.md` (헤더+fallback 회귀0, 8 sub-task 순서) |
| 3 구현 | developer | ✅ 완료(v2) | `04-implementation.md` (177 test, 커밋 d35e6a0) |
| 4 리뷰 | reviewer+codex | 🔄 재검증(v2) | `05-review.md` |

## 진행 로그
- 2026-05-31 — T8 시작. mock 역할전환 / 전체범위 / 크루 2~3명. 최대 규모 task.

---

# 🎉 Task 최종 결과 — T8 (계정/권한 분리, rework 1회 후 PASS)

## 결과 (4요구 전부 충족)
1. ✅ **마스터 = 전체 크루 근무/휴일 조회**: `/master` 집계뷰(CrewSummaryList) + `/master/[crewId]` 드릴다운(크루별 근무/휴일 상세). `GET /api/master/crews`(마스터 게이트).
2. ✅ **크루 = 초대로만 합류**: `POST /api/invites`(마스터 생성) + `/api/invites/join`(코드 합류, 없는코드 400/사용됨 409). InvitePanel.
3. ✅ **크루 = 본인 스케줄만**: `enforceReadScope`로 크루는 본인 crewId 강제(타인 노출 0). 9개 read API 일관 적용.
4. ✅ **변경 컨펌 = 마스터만**: approve API role≠master → 403 + store 불변, EditRequestList 수락버튼 canApprove 게이트(UI 숨김). 이중 방어.

## 구조
- 데모 mock 역할전환(로그인 없음): CurrentUserProvider(localStorage, 하이드레이션 mount-gate) + 마이페이지 RoleSwitcher. 헤더 `x-crew-id`/`x-role` 전달.
- store recordsByCrew 멀티크루(마스터1+크루3), crewId trailing append+fallback(김민정) → **회귀 0**.
- **검증**: 177 테스트 GREEN(기존 138 회귀 0 + T8 신규 39), tsc/build/lint 0, codex 코드축 PASS. ADR 0005.
- 커밋: `161cb23`(청크1) → `4c22381`(청크2) → `1e295a1`(청크3) → `d35e6a0`(rework v2). 전부 main.

## 남은 follow-up (비차단)
- **P2(시각 버그)**: `MasterCrewDetail` 날짜에 요일 중복("2026.05.09 토 (토)") — formatDotDate가 이미 요일 포함, 1줄 제거.
- P1: crew-2/3 급여 주휴수당 분리(현재 mock 고정, PRD 비목표).
- P2: 전환 stale 1-frame(key 기반 리셋), 초대코드 소진/미등록 crewId 방어, active=false 크루 RoleSwitcher 정책.
- (기존) /pay 월네비 + "5월 급여" 동적 레이블(이제 6월이라 실제 필요), pay/[date] 휴게범위 하드코딩.

## 산출물
- `docs/tasks/2026-05-31-accounts-roles/{01-prd,02-approval,03-architecture,04-implementation,05-review}.md`
- `CONTEXT.md`(T8 용어 20개), `docs/adr/0005-accounts-roles-mock.md`
