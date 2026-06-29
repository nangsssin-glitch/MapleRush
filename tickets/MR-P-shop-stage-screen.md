---
id: MR-P
title: 상점 스테이지 화면 PDF 디자인 정비
status: review
owner: D4LGONA
area: ui
touches:
  - ui/ShopGroup.ui
  - RootDesk/MyDesk/UI/ShopController.mlua
depends_on: []
branch: "D4LGONA/MR-P-shop-stage-screen"
created: 2026-06-28
updated: 2026-06-29
---

# 상점 스테이지 화면 PDF 디자인 정비

## Goal
상점 스테이지 화면(ShopGroup)을 설계서 p.10 "상점 스테이지"에 맞춰 레이아웃/톤 정비한다. NPC + 말풍선, 좌측 보유 메소, 5품목 카드(가격+구입하기), 우하단 나가기. (구매 확인 팝업 자체는 MR-C에서 완료 — 이 티켓은 상점 "화면"의 PDF 정합.)

## Acceptance criteria
- [ ] NPC + 말풍선("형씨, 가기 전에 한 번 둘러봐.") 표시
- [ ] 좌측 상단 "보유 메소: n" Text → `GameStateManager.Meso` 바인딩
- [ ] 품목 카드 ×5: 최대 목숨 +1 / 스탯 강화1 / 스탯 강화2 / 능력 획득·강화 / 일회성 아이템 (아이콘 + 강화명)
- [ ] 각 카드 가격 Text → `ShopManager.Price*` (목숨 100 / 스탯 50 / 능력 150 / 아이템 40 등 현행 상수)
- [ ] 카드별 "구입하기" Button → `RequestBuy*` → 구매 확인 팝업(MR-C)
- [ ] 우하단 "나가기" Button → `RequestLeaveShop` → 보스 노드
- [ ] 색·아이콘 게임 톤 정비 (구입=레드 톤 / 나가기=청록 등 PDF 색 구분)

## Subtasks
<착수 시 채움>
- [ ]

## Notes / decisions
- 설계서 p.10은 우상단 **"기존"** 배지 — 현재 `ShopGroup.ui`·`ShopController` 레이아웃을 기준으로 그린 이미지. 따라서 대규모 재작성이 아니라 **PDF 정합 확인 + 색/아이콘/누락요소(NPC·말풍선·보유메소 등) 보강** 성격.
- 구매 확인 팝업 = **MR-C (DONE)**. 토스트/보상/게임오버 등 다른 보조 화면 톤 = **MR-N**. 이 티켓은 상점 "스테이지 화면" 본체에 한정.
- 입력 컨텍스트 = Shop.
- 출처: `docs/maplerush_UI_ver1.pdf` p.10.

## Verify
- Maker `play` → 상점 진입 → NPC/말풍선/보유메소/5카드/가격/나가기 표시, 구입→확인팝업, 나가기→보스 진행 확인. build/runtime 에러 0.
