---
id: MR-M
title: 테마 선택 2→3테마 확장
status: review
owner: D4LGONA
area: mixed
touches:
  - ui/ThemeSelectGroup.ui
  - RootDesk/MyDesk/UI/ThemeSelectController.mlua
  - RootDesk/MyDesk/Stage/FloorManager.mlua
depends_on: []
branch: "D4LGONA/MR-M-theme-select-3themes"
created: 2026-06-26
updated: 2026-06-28
---

# 테마 선택 2→3테마 확장

## Goal
테마 선택 화면을 기존 2테마에서 3테마(오르비스·엘나스·폐광)로 확장한다. 중앙 3카드, 미플레이 테마만 표시(2층은 2개). (UI 설계서 p.8 "테마 선택")

## Acceptance criteria
- [x] 테마 카드 ×3: Button(카드) — 오르비스·엘나스·폐광
- [x] 카드 일러: 키비주얼 Sprite (오르비스=구름 `2f873e…` / 엘나스=설산 `83b879…` / 폐광=갱도 `fc4dc7…`)
- [x] 카드 선택 → `RequestSelectTheme(orbis/elnath/deepmine)` (체인 로그 검증: theme selected → NodeSelect)
- [x] 미플레이 테마만 노출 (Enable 토글, 2층 시뮬 시 2카드)
- [x] 입력 컨텍스트 Node에서 동작

## Subtasks
- [x] 키비주얼 3종 RUID (msw-search): 오르비스/엘나스/폐광
- [x] `ThemeSelectGroup.ui` 재구성: 2버튼 → 중앙 3카드(키비주얼+이름 스트립), UIBuilder (displayOrder 7 보존)
- [x] `ThemeSelectController`: btnTheme1/2 → btnOrbis/Elnath/Deepmine, `Open(3-bool)`, 3 핸들러
- [x] `FloorManager`: usedThemes orbis/elnath/deepmine, `ShowThemeSelect`/`ClientShowThemeSelect` 3-bool, fallback 첫 가용
- [x] 미플레이만 노출(Enable 토글), 2층 시뮬 시 2카드
- [x] Verify: play → 3카드 표시·선택체인·2층 2카드 / build 0에러

## Notes / decisions (착수 후)
- 테마 id: `orbis`/`elnath`/`deepmine` (맵명 OrbisLevel/ElnathLevel/DeepMineLevel과 일치). `CurrentTheme`는 현재 기록만 — 테마→맵/몬스터 콘텐츠 연결은 별도 범위(미구현).
- ⚠️ 알려진 사소한 점: 카드 위치 고정 → 사용된 테마 1개 숨김 시 그 슬롯이 빈칸으로 남음(2층). 런타임 재정렬은 후속 폴리시(선택).

## Notes / decisions
- ⚠️ 기존 컨트롤러가 **2테마 인자 기준** → 3테마로 확장 필요 (UI뿐 아니라 컨트롤러 로직 수정 → area=mixed).
- 출처: `docs/maplerush_UI_ver1.pdf` p.8.

## Verify
- Maker `play` → 테마 선택 진입 → 3카드 표시·선택 동작, 2층 진입 시 2카드만 노출되는지 확인.
