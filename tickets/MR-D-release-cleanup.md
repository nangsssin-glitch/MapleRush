---
id: MR-D
title: 릴리스 정리 (디버그 경로 제거/게이팅)
status: backlog
owner: unassigned
area: script
touches:
  - RootDesk/MyDesk/Core/InputRouter.mlua
  - RootDesk/MyDesk/Player/PlayerCombat.mlua
  - RootDesk/MyDesk/Player/SlowMotion.mlua
depends_on: []
branch: ""
created: 2026-06-19
updated: 2026-06-19
---

# 릴리스 정리 (디버그 경로 제거/게이팅)

## Goal
테스트용 디버그 경로가 라이브에 남아 있다. 릴리스 전 제거하거나 게이팅한다. 기능 검증이 충분히 끝난 뒤 마지막 단계에서 진행 (그 전까지는 테스트에 유용하므로 유지).

## Acceptance criteria
- [ ] G키 `debugSlow`(InputRouter) 제거 또는 디버그 플래그로 게이팅
- [ ] `PlayerCombat.RequestDebugSlow`(현재 ungated) 제거 또는 게이팅
- [ ] (선택) 슬로우모션 '플레이어 제외' 방식 최종 결정 — 글로벌 타임스케일 유지 vs per-entity만

### MR-S 스파이크 잔재 정리 (MapleTile 확정에 따라 — 2026-06-20 일괄 처리됨)
- [x] `GameConstants.MapNormal` `"mapSV"`→`"map02"` 원복 + 죽은 코드(NormalMapChoice 그림자) 제거 (리뷰 #1)
- [x] `GameConstants.NormalMapChoice`(@Sync) 제거 + `MapIdForStage` 단순화
- [x] `FloorManager.RequestSelectNode` SV/MV 분기 제거 → `StartStage("normal")`
- [x] 노드 UI 원복: `NodeSelectController` 타이틀 "노드 선택", `NodeSelectGroup.ui` 버튼 "전투 A/B/C" + BtnNode3 재활성 (UIBuilder, lint clean)
- [x] Debug 파일 삭제: `Debug/DebugMapToggle.{mlua,codeblock}`, `Debug/SideViewArenaBuilder.{mlua,codeblock}`, `Debug.directory` (폴더 비움)
- [x] SideView 에셋 삭제: `map/mapSV.map`, `SVTilemap.tileset`
- [ ] **[사용자/Maker]** `Global/SectorConfig.config`에서 `mapSV` 등록 해제 (Global/ 읽기전용 → AI 불가)
- [ ] (선택) `docs/MapleRush_CodeMap.html`의 mapSV/Debug 참조 갱신 — 생성 문서라 런타임 무관
- [ ] 휴면 SideView 분기(적 `IsSideViewMap`/`ChaseToward`, 대시 `DashMoveTo`/`IsDashSideView`, `EnemyChaseSpeed`, 적 모델 Sideviewbody)는 MapleTile에선 무해 → **MR-G(적 FSM 정비)에서 정리**

## Subtasks
- [ ] (작업 시작 시 owner가 채움)

## Notes / decisions
- 마지막에 진행 권장 (기능 테스트 도구로 쓰임).
- 슬로우모션 이슈: 현재 per-entity 서버 스케일(플레이어 제외 정상) + 글로벌 `SetClientTimeScale(0.25)`도 호출 → 플레이어 클라도 느려짐. 불릿타임 느낌 유지 vs 플레이어 풀스피드 중 결정 필요.

## Verify
- `play` → G키 등 디버그 입력이 더 이상 동작 안 하는지(또는 플래그 off 시) 확인.
