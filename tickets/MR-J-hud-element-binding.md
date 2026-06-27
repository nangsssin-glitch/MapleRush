---
id: MR-J
title: 게임 HUD 요소 바인딩 (목숨/대시/아이템/능력/메소)
status: review
owner: D4LGONA
area: ui
touches:
  - ui/HUD.ui
  - RootDesk/MyDesk/UI/HUDController.mlua
depends_on: []
branch: "D4LGONA/hud-element-binding"
created: 2026-06-26
updated: 2026-06-27
---

# 게임 HUD 요소 바인딩

## Goal
게임 진행 HUD(좌상단 세로 [목숨·대시·아이템] + 우측 능력 / 우상단 메소)의 각 요소를 서버 `@Sync` 데이터에 바인딩해 실시간 표시한다. (UI 설계서 p.6 "게임 진행 HUD")

## Acceptance criteria
- [x] 목숨: 아이콘(HP 스프라이트) + "× N" Text가 `GameStateManager.CurrentLives` 반영
- [x] 대시: pip 사각형 N칸이 `PlayerDash.DashCount / MaxDash` 반영 — MaxDash 초과 칸 비활성(Enable=false), 현재 DashCount만큼 금색 채움
- [x] 아이템 슬롯 ×3: 카드 Button이 `PlayerItems.Slot1~3` 라벨 반영(활성 ▶ 강조)
- [x] 능력: 우측 Button 라벨이 `PlayerAbility.AbilityId / UsesLeft` 반영
- [x] 메소: 우상단 코인 아이콘 + Text가 `GameStateManager.Meso` 반영
- [x] HUDController OnBeginPlay/OnUpdate 정상 구동 (런타임 로그 확인, 에러 0)

## Subtasks (D4LGONA, 2026-06-27)
- [x] 기존 HUD 분석 — 데이터 바인딩은 이미 텍스트로 구현돼 있었음. 본 작업 = 설계서 p.6 시각화
- [x] 아이콘 스프라이트 검색(msw-search): 코인 `02a489cc…`, HP `043d30b5…`
- [x] HUD.ui 재구성(UIBuilder): StatusBox(목숨 아이콘+Text / 대시 Filled 게이지 / 아이템 카드×3) + 우측 능력 버튼 + 우상단 메소 박스(코인). 18개 엔티티
- [x] HUDController 재작성 — 텍스트 라벨 → 게이지 FillAmount / 카드 라벨 / 능력 버튼 / 메소 구동. 바인딩 9개 주입
- [x] Verify: refresh→빌드 로그 0 → play → `[HUDController] OnBeginPlay (visual HUD)` + 런타임 에러 0

## Notes / decisions
- 바인딩 데이터는 전부 서버 권위 `@Sync` — UI는 표시만 (설계서 공통규칙 p.3 "바인딩 데이터").
- 공통 규칙: UIGroup GroupOrder HUD=1(항상 바닥), 게이지는 SpriteGUIRenderer Filled 모드.
- 출처: `docs/maplerush_UI_ver1.pdf` p.6.
- 변경 파일: `ui/HUD.ui`(재구성), `RootDesk/MyDesk/UI/HUDController.mlua`(재작성).
- 대시 표시: 설계의 "◇ pip ×N"을 사각형 pip 4칸으로 구현 — MaxDash 초과 칸은 Enable=false로 숨김, 현재 충전 수만큼 금색. 아이템 카드는 클릭 핸들러 없음(아이템 사용은 키 입력 라우터 경유).
- 아이템 활성 슬롯 표시: 깨지던 '▶' 문자 제거 → 활성 슬롯 카드 배경을 금색(대시 pip와 동일 톤)으로 강조 + 글자 대비 처리 (2026-06-27).
- ⏳ 시각 레이아웃은 런타임 로그로는 확인 불가 — Maker play 화면에서 사용자 육안/스크린샷 확인 필요. 보스 텍스트(MR-K)는 기존대로 유지.

## Verify
- Maker `play` → 전투 진입 → 목숨/대시/아이템/능력/메소 값이 실제 상태와 일치하는지 `logs`로 확인.
