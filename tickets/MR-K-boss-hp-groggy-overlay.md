---
id: MR-K
title: 보스 HP·그로기 게이지 오버레이
status: review
owner: D4LGONA
area: ui
touches:
  - ui/HUD.ui
  - RootDesk/MyDesk/UI/HUDController.mlua
depends_on: []
branch: "D4LGONA/boss-hp-groggy-overlay"
created: 2026-06-26
updated: 2026-06-27
---

# 보스 HP·그로기 게이지 오버레이

## Goal
보스 스테이지에서 기존 게임 진행 HUD 위에 중앙 상단 보스 HP 바 + 그로기 게이지 오버레이를 추가한다. (UI 설계서 p.7 "보스 스테이지")

## Acceptance criteria
- [x] 보스 HP 바: Sprite(Filled Horizontal)가 `EnemyHealth.HP / MaxHP` 반영
- [x] 그로기 게이지: Sprite(Filled Horizontal)가 `GroggyGauge.Gauge / GaugeMax` 반영
- [x] 그로기 상태 연출(점멸 등): `GroggyGauge.IsGroggy` true일 때 흰/노랑 점멸 + "그로기!" 표시
- [x] 보스 스테이지에서만 노출, 일반 스테이지에선 숨김 (보스 미발견 시 Enable=false)
- [x] 나머지 HUD는 게임 진행 HUD와 동일 동작

## Subtasks (D4LGONA, 2026-06-27)
- [x] 데이터 소스 확인 — EnemyHealth(HP/MaxHP/EnemyKind/IsDead), GroggyGauge(Gauge/GaugeMax/IsGroggy) 모두 @Sync. 기존 UpdateBossText가 이미 보스 탐색 중
- [x] HUD.ui: 임시 BossText 제거 → 중앙상단 BossOverlay 패널 추가 (보스명 + HP바 Filled + 그로기바 Filled + 텍스트)
- [x] HUDController: bossText → bossOverlay/bossHpFill/bossHpText/groggyFill/groggyText 프로퍼티 교체, UpdateBossOverlay/UpdateGroggy 작성 (FillAmount 반영 + 그로기 점멸 연출 + 보스 없으면 Enable=false)
- [x] 바인딩 주입(UIBuilder write bind) 5개
- [x] Verify: refresh→빌드0→play→런타임 에러0. execute_script로 5개 바인딩 resolved + FillAmount/Text 주입 동작 확인

## Notes / decisions
- 기존 `HUD.ui`에 보스 오버레이 요소를 **추가**하는 형태 (별도 .ui 아님).
- MR-J(HUD 요소 바인딩) 위에 얹히는 구조 — **soft-depend on MR-J** (HUD 자체는 이미 존재해 hard block은 아님; MR-J 미완이어도 착수 가능하나 함께 보면 효율적).
- 게이지는 Filled 모드 (설계서 공통규칙).
- 구조: HUD.ui에 BossOverlay(중앙상단) = 보스명 + HP바(트랙+Filled) + 그로기바(트랙+Filled) + 텍스트. 솔리드 스프라이트 RUID는 기존 대시 pip(`4fea64a3…`) 재사용.
- 그로기 텍스트는 빈/충전/점멸 모든 상태 가독성 위해 흰색 + 진한 아웃라인(width 3) — 사용자 레이아웃 조정분 유지.
- 출처: `docs/maplerush_UI_ver1.pdf` p.7.

## Verify
- Maker `play` → 보스 스테이지 진입 → 보스 HP/그로기 게이지가 데미지·그로기 누적에 따라 갱신, IsGroggy 시 연출 확인.
