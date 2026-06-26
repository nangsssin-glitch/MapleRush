---
id: MR-C
title: 상점 구매 확인 팝업
status: done
owner: D4LGONA
area: ui
touches:
  - RootDesk/MyDesk/UI/ShopController.mlua
  - ui/
depends_on: []
branch: "D4LGONA/shop-confirm-popup"
created: 2026-06-19
updated: 2026-06-26
---

# 상점 구매 확인 팝업

## Goal
상점에서 품목 좌클릭 시 바로 구매되어 오구매 위험이 있다. 설계(stage_design §2.4.2)대로 **"정말로 구입하겠습니까?"** 확인 팝업(확인/취소)을 넣는다. (현재 ShopController에 "Phase 8 폴리시"로 미구현 표시됨)

## Acceptance criteria
- [x] 품목 좌클릭 → 확인 팝업 표시 (품목명/가격/효과)
- [x] 확인 시에만 메소 차감·효과 적용·가격 2배 갱신
- [x] 취소 시 아무 변화 없음
- [x] 메소 부족 시 적절한 피드백 (구매 불가)

## Subtasks (D4LGONA, 2026-06-20)
- [x] 기존 `_UIPopup`(범용 확인팝업) 바인딩 검증 — PopupGroup.ui UUID 5개 일치 확인
- [x] ShopController에 TryBuy(label, price, buyFn) 헬퍼 추가 (메소부족 피드백 + 확인팝업 분기)
- [x] 4개 OnXClick 핸들러를 즉시구매 → TryBuy 경유로 변경
- [x] PopupGroup displayOrder 3→10 (상점=7 등 위로) — 확인팝업이 상점 패널 뒤에 가려지던 z-order 버그 수정
- [x] Verify: Maker play 4 AC 전부 통과 (아래 결과)

## Notes / decisions
- 구매 로직(4종/가격갱신/차감)은 ShopManager에 이미 동작 — 이 티켓은 확인 단계 UI만 추가.
- `.ui`는 반드시 빌더(UIBuilder)로 — raw JSON 편집/grep 금지. 구현 전 msw-ui-system 로드.
- 모드 독립 — 선행 가능.
- **구현 방향(확정)**: `ui/PopupGroup.ui` + `UIPopup.mlua`(`_UIPopup:Open(msg, onOk, onCancel)`)가 이미 존재하는 범용 OK/취소 확인팝업 — 미사용 상태였고 MR-C가 첫 사용처. 바인딩 5개(message/btnOk/btnCancel/popupGroup/popup) 전부 현재 .ui와 일치 검증됨. → `.ui` 신규 작업 없이 ShopController.mlua만 수정.
- AC4(메소부족): 클라에서 `_GameStateManager.Meso < price`면 확인팝업 대신 "메소 부족" 안내팝업. 서버 RequestBuyX도 SpendMeso로 재검증(이중 방어).

### 구현 결과 (2026-06-20)
- 변경 파일: `RootDesk/MyDesk/UI/ShopController.mlua`(TryBuy 헬퍼 + 4핸들러), `ui/PopupGroup.ui`(displayOrder 3→10). 신규 `.ui` 없음 — 기존 `_UIPopup` 재사용.
- ⚠️ z-order 버그 발견·수정: PopupGroup displayOrder=3 < ShopGroup=7 → 확인팝업이 상점 뒤에 가려짐. 모달 확인팝업이므로 10(전 그룹 최상단)으로 상향.
- Verify(Maker play, 확인팝업 플로우 직접 구동):
  - AC1: 최대목숨 클릭 → 팝업 "최대 목숨 +1 / 가격: 100 메소 / 구입하시겠습니까?" ✓
  - AC2: OK → meso 5000→4900, maxLives 5→6, price 100→200 ✓
  - AC3: 스탯 클릭 후 취소 → meso/price 무변화 ✓
  - AC4: 메소 10에서 능력(150) 클릭 → "메소가 부족합니다 / 보유 10 / 필요 150" 피드백, 구매 안 됨 ✓
  - 아이템 OK → smoke 지급, meso-40, price×2 ✓ / 빌드·런타임 에러 0
- 비고: `_UIPopup`은 기존에 존재했으나 미사용이었고 MR-C가 첫 사용처. 메소부족 팝업은 OK/취소 둘 다 닫힘(onOk=nil) — 추후 토스트로 바꾸면 더 적합하나 MVP는 팝업으로 충분.

### z-order 회귀 재수정 (2026-06-26)
- 증상 재발: 확인 팝업이 다시 상점 창보다 **뒤에** 표시됨. master 머지/빌더 재직렬화 과정에서 값이 회귀한 것으로 추정.
- 원인 정정: 그룹 간 z-order는 엔티티 `displayOrder`가 아니라 **`UIGroupComponent.GroupOrder`**가 결정한다(`ui-hierarchy.md` §4). 06-20 노트의 "displayOrder"는 실제로 GroupOrder를 가리킴.
- 확인된 실제 값: PopupGroup `GroupOrder=3` < ShopGroup=7 (+ ToastGroup=5). → UIBuilder로 PopupGroup `GroupOrder 3→10` 복구. lint 통과, 빌드 에러 0, Maker play 재검증에서 팝업이 상점 앞에 표시 확인.
- ⚠️ 잠재 이슈(미해결): ToastGroup `GroupOrder=5` < ShopGroup=7 — 상점 위 토스트는 가려짐. 권장 20. 본 티켓 범위 밖, 별도 처리.

### ⚠️ 디버그 치트 동봉 (릴리스 전 제거 필수)
- 이 브랜치에는 **디버그용 M키 메소 +10 치트**가 포함됨: `RootDesk/MyDesk/Debug/DebugMesoCheat.mlua` (`@Logic`, 커밋 `88496b0`).
- 상점 구매 테스트 편의용 임시 코드. **MR-D(릴리스 정리/디버그 게이팅)에서 반드시 제거 또는 게이팅** 후 릴리스.

## Verify
- Maker `play` → 상점에서 품목 클릭 → 확인/취소 동작 → 확인 시에만 메소 차감되는지 `logs`로 확인.
