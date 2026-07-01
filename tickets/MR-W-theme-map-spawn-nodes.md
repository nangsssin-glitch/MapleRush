---
id: MR-W
title: 테마→레벨맵 진입 + 노드 3분기=스폰포인트 선택
status: done
owner: dust9826
area: script
touches:
  - RootDesk/MyDesk/Core/GameConstants.mlua
  - RootDesk/MyDesk/Stage/StageManager.mlua
  - RootDesk/MyDesk/Stage/FloorManager.mlua
depends_on: []
branch: ""
created: 2026-07-01
updated: 2026-07-01
---

# 테마→레벨맵 진입 + 노드 3분기=스폰포인트 선택

## Goal
일반 스테이지가 플레이스홀더 map02 대신 **선택된 테마의 수제작 레벨맵**(orbis→OrbisLevel / elnath→ElnathLevel / deepmine→DeepMineLevel)으로 진입하고, FloorManager의 빈 **노드 3분기 선택**에 의미를 부여한다(= 그 맵의 SpawnPointPosition 중 3개). 플레이어는 선택한 스폰포인트에서 스폰.

## 배경
- 기존: `StartStage`→`MapIdForStage`가 일반=map02 고정, 플레이어 스폰 하드코딩 `(0,0.3)`. 레벨맵 3종은 고아(스크립트 미참조).
- FloorManager 노드 선택은 플레이스홀더("3분기 전부 일반 스테이지, branchIdx 무시").
- ★MR-R가 죽은 키불일치: `MoveToMapPosition`/`cm.Name`/`/maps/<x>` 모두 **Hierarchy name**을 요구(doc 확인). 레벨맵은 name=대문자(ElnathLevel)·entry-id=소문자(elnathlevel) → **반드시 name 사용**.

## 구현 (완료)
- **GameConstants**: `MapForTheme(theme)` → "OrbisLevel"/"ElnathLevel"/"DeepMineLevel" (name 그대로).
- **StageManager**:
  - `@Sync CurrentMapId` + `pendingSpawnPoint` 프로퍼티. StartStage에서 맵 1회 확정(일반=테마맵/보스=map03/상점=map04)해 GetMap까지 동일 맵 보장.
  - `StartStage(stageType, spawnPointName)` 2-param화.
  - `ResolveSpawnPos(map, spName)`(@ExecSpace 없음=양측) — 맵의 지정 스폰포인트(없으면 base, 둘 다 없으면 (0,0.3)) WorldPosition.
  - `CollectSpawnPointNames(map)`(server) — 맵 직계 자식 중 "SpawnPointPosition*" 이름 수집.
  - `MovePlayerToMap`/`ClientStageReset`가 하드코딩 (0,0.3) → 선택 스폰포인트 좌표로 스폰.
  - `GetMap`이 CurrentMapId 기반.
- **FloorManager**: `nodeSpawnChoices` + `PrepareNodeSpawns()`(테마맵에서 스폰포인트 3개 무작위 추출, 부족 시 기본 세트 폴백). `RequestSelectNode(branchIdx)` → `nodeSpawnChoices[branchIdx]` → `StartStage("normal", sp)`. StartStage 호출 4곳 2-param화.

## Acceptance criteria
- [x] 테마 orbis → OrbisLevel 진입 (name 기반, 키불일치 없음).
- [x] 노드 3분기 = 그 맵 SpawnPointPosition 3개(서로 다름) 추출.
- [x] 선택 분기의 스폰포인트에서 플레이어 스폰(좌표 일치, foothold 안착).
- [x] 도착 폴링(`cm.Name=="OrbisLevel"`) 성립 → 적 스폰까지 진행.
- [x] 빌드 0에러(내 파일), 런타임 nil/Lua 에러 0.

## Verify (play, execute_script server 구동)
- `node spawns (map OrbisLevel): SpawnPointPosition_4 / SpawnPointPosition / SpawnPointPosition_5` / 분기2→base(`-9.85,-2.84`) / `moving player -> OrbisLevel` / `player arrived at OrbisLevel -> spawn` / `ResetStage done: spawned=4` / 플레이어 map=OrbisLevel pos x=-9.85(중력 낙하해 foothold y=-3.53 안착).

## 잔여 / 후속 (이 티켓 범위 밖)
- **적 배치 고정**(사용자 결정): RollComposition 좌표가 map01 기준 하드코딩 → 레벨맵별/스폰포인트별 상대배치는 후속(MR-A 폴리시). Elnath/DeepMine에서 적이 foothold에 안착하는지 미검증(OrbisLevel만).
- **노드 UI 시각화**: 3 스폰포인트를 노드 화면에 보여주는 건 D4LGONA UI 영역(현재는 일반 3버튼=스폰포인트 매핑만, 보이지 않게 동작).

## LEA-3004 후속 조사 (2026-07-01)
- 초기 다중 LEA-3004(PhysicsSimulator)의 원인 = **내 코드가 비활성(미진입) 맵을 GetEntityByPath/children로 조회**한 것. `PrepareNodeSpawns`(맵 조회 제거, 스폰포인트 이름 풀에서 추출) + `MovePlayerToMap`(대상맵 사전조회 제거, 도착 후 ClientStageReset가 활성 맵에서 좌표 해소)로 **제거 완료**. `CollectSpawnPointNames` 데드코드 삭제.
- 검증(fresh play): 시작 시 LEA-3004 **0건**, 테마→노드→스폰 플로우 후 **1건만 잔존**. 플레이어·몬스터 onGround=true(물리 정상).
- 잔존 1건 = 네이티브 `MoveToMapPosition`가 레벨맵 **첫 활성화** 시 1회. 레벨맵이 신형 foothold 포맷(PhysicsInteractable/edgeLists)인데 `PhysicsSimulatorComponent`가 없어서. map02(구형 포맷)는 안 뜸. **물리엔 영향 없음**(몬스터 foothold 안착 확인).
- 완전 silence하려면 3 레벨맵 루트에 `MOD.Core.PhysicsSimulatorComponent` 추가(.map 재직렬화) — 보류/판단 대기.
- map02는 일반 스테이지에서 미사용화(MapNormal/MapIdForStage normal 분기 dead).
- 🔗 MR-A(맵 다양화 랜덤 풀)·MR-I(대시 방-영역 클램프)와 결 연결. 다른 테마(elnath/deepmine)·다른 분기 스팟체크 권장.
