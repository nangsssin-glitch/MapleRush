---
id: MR-C
title: 상점 구매 확인 팝업
status: todo
owner: unassigned
area: ui
touches:
  - RootDesk/MyDesk/UI/ShopController.mlua
  - ui/
depends_on: []
branch: ""
created: 2026-06-19
updated: 2026-06-19
---

# 상점 구매 확인 팝업

## Goal
상점에서 품목 좌클릭 시 바로 구매되어 오구매 위험이 있다. 설계(stage_design §2.4.2)대로 **"정말로 구입하겠습니까?"** 확인 팝업(확인/취소)을 넣는다. (현재 ShopController에 "Phase 8 폴리시"로 미구현 표시됨)

## Acceptance criteria
- [ ] 품목 좌클릭 → 확인 팝업 표시 (품목명/가격/효과)
- [ ] 확인 시에만 메소 차감·효과 적용·가격 2배 갱신
- [ ] 취소 시 아무 변화 없음
- [ ] 메소 부족 시 적절한 피드백 (구매 불가)

## Subtasks
- [ ] (작업 시작 시 owner가 채움)

## Notes / decisions
- 구매 로직(4종/가격갱신/차감)은 ShopManager에 이미 동작 — 이 티켓은 확인 단계 UI만 추가.
- `.ui`는 반드시 빌더(UIBuilder)로 — raw JSON 편집/grep 금지. 구현 전 msw-ui-system 로드.
- 모드 독립 — 선행 가능.

## Verify
- Maker `play` → 상점에서 품목 클릭 → 확인/취소 동작 → 확인 시에만 메소 차감되는지 `logs`로 확인.
