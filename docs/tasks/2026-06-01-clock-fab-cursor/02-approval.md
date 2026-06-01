# 02-approval — 승인 결정 (T11)
- orchestrator(사용자 게이트) / 대상 01-prd.md / ✅ APPROVED 2026-06-01

## 결정: APPROVE
| Q | 결정 | 지침 |
|---|---|---|
| Q1 FAB 동작 | **즉시 등록** | FAB 탭 시 현재 phase(미출근→출근/근무중→퇴근/마감→비활성)에 따라 현재시각으로 즉시 PATCH. 확인 시트 없음. |
| Q2 마스터 FAB | **노출(본인 스코프)** | 마스터 화면에도 FAB 노출, 본인(master) crewId 스코프로 등록. 단순 유지. |
| (planner) 공용화 | useTodayClock 훅 추출 | ClockToggle 인라인 로직 → `useTodayClock` 훅으로 추출, ClockToggle/ClockFab 공유(단일 진실원). ClockToggle 동작 불변. |
| z-index | FAB z-40 | BottomNav z-30 < FAB z-40 < BottomSheet z-50. BottomNav 비겹침. |

## 제약
append-only, 191 회귀 0, 크루 스코프(authHeaders), 날짜클릭 상세·홈 ClockToggle 불변, 하이드레이션 안전(mount-gate), cursor 전역 base(disabled 제외).
