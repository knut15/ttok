# 02-approval — 승인 결정 (T10)

- **작성**: orchestrator (사용자 게이트) / **대상**: `01-prd.md` / **상태**: ✅ APPROVED (2026-06-01)

## 최종 사용자 결정: APPROVE

| Q | 결정 | 지침 |
|---|---|---|
| Q1 마스터 컨펌 위치 | **`/master` 안에 섹션** | 마스터 집계뷰에 "수정요청 컨펌" 섹션 — 전체 크루 대기 요청 목록(크루 이름 표시) + 수락 버튼. 별도 라우트 X. |
| Q4 아이콘 32x32 범위 | **클릭 버튼만** | 실제 동작하는 아이콘 버튼(‹ › 월네비, 상세 일자네비, 📷 사진변경, 뒤로 ‹ 등)만 32×32. 🔔(홈벨)·⤓(다운로드) 비클릭 장식 span은 제외(버튼 아님). |
| Q2 FR-1 구현 | ClockToggle 최소수정 (architect 확정) | useCurrentUser로 authHeaders 주입 + crewId effect 의존성. 훅 이관 대신 in-place. |
| Q3 FR-3 구현 | className 교체 (architect 확정) | 공용 IconButton 신설 대신 대상 버튼 className에 `h-8 w-8` + 중앙정렬 적용(또는 architect가 IconButton이 더 깔끔하다 판단 시 채택 가능). |

## 제약
append-only, 기존 186 테스트 회귀 0, 크루 본인스코프·마스터 게이트 유지, 하이드레이션 안전, RSC/client 경계.
- FR-2 권한: `GET /api/master/requests` 마스터 게이트(크루 403). 수락은 기존 approve API(마스터) 재사용.
- FR-1: 크루별 개별 출근 격리(크루A 토글이 크루B 미영향) — 통합테스트로 검증.
