---
id: MR-X
title: 맵 내 stage 구역 시스템 (노드=stage 선택 + 몬스터 마커 스폰)
status: in-progress
owner: dust9826
area: mixed
touches:
  - RootDesk/MyDesk/Stage/FloorManager.mlua
  - RootDesk/MyDesk/Stage/StageManager.mlua
  - map/ElnathLevel.map
  - map/OrbisLevel.map
  - map/DeepMineLevel.map
depends_on: [MR-W]
branch: ""
created: 2026-07-01
updated: 2026-07-01
---

# 맵 내 stage 구역 시스템 (노드=stage 선택 + 몬스터 마커 스폰)

## Goal
MR-W의 "노드 3분기 = SpawnPointPosition 선택"을 **"노드 3분기 = 맵 안 stage 구역 선택"**으로 확장. 각 레벨맵 안에 `stage*` 컨테이너를 여러 개 두고(각각 플레이어 스폰 위치 + 몬스터 배치 포함), 노드에서 stage를 골라 그 구역에서 전투. 몬스터가 **해당 위치에 해당 종류로** 정확히 나오게 한다.

## 확정된 설계 결정 (사용자, 2026-07-01)
1. **맵 1회 진입 + stage=하위구역**: 테마 맵에 한 번만 진입, 이후 일반 노드마다 **맵 재전환 없이** 맵 안 stage 구역으로 텔레포트. (맵이 계속 active → stage 조회 안전 = 지난 세션 LEA-3004(비활성 맵 조회) 원천 회피 / 반복 맵로딩·경고 없음)
2. **마커 위치에 재스폰**: stage 진입·사망재시작 시 살아있는 적 제거 후 그 stage의 몬스터 마커에서 새로 스폰. 기존 `ResetStage`(파괴+재스폰) 로직 재사용, 재시작·클리어 판정 동일.
3. **실제 몬스터 모델 배치**: 마커 = Maker에 배치된 실제 몬스터 모델 인스턴스(meleeenemy/rangedenemy 등). Maker에서 눈으로 확인(WYSIWYG). 런타임은 그 위치+종류를 읽어 스폰.

## 맵 구조 (Maker authoring — 사용자가 만듦)
```
{Theme}Level (map root)
├── stage1                 ← stage 컨테이너 (빈 엔티티)
│   ├── PlayerSpawn        ← 플레이어 스폰 마커 1개
│   ├── (meleeenemy 인스턴스)  ← 위치+종류 마커 겸용, 평소 비활성
│   ├── (rangedenemy 인스턴스)
│   └── (프롭 등 optional)
├── stage2 / stage3 ...
```

## 설계 스케치 (구현 시 확정)
- **stage 열거**: 맵 active 상태에서 `map` 자식 중 이름 `stage`로 시작하는 것 수집(GetChildByName/Children). 노드마다 그중 N개(3) 제시.
- **몬스터 마커 → 스폰 방식(택1, 구현 시 결정)**:
  - (a) `SpawnByEntity(clone)`: 배치된 비활성 원본을 프로토타입으로 clone → 활성 스폰. modelId 문자열 읽을 필요 없음. 사망 시 clone 파괴 후 재clone.
  - (b) modelId+위치 읽어 `SpawnByModelId`: 런타임에 원본의 소스 modelId 취득 방법 필요(불확실) → (a) 우세.
  - 원본 배치 인스턴스는 초기 비활성(Enable=false)로 두거나, 시스템 init 시 비활성/데이터화.
- **StageManager**: `RollComposition` 하드코딩 좌표(x=5.5~8.5) 제거 → "선택 stage의 몬스터 마커 목록"으로 대체. `pendingSpawnPoint` → `pendingStage`. ResetStage가 그 stage의 마커에서 스폰 + PlayerSpawn으로 텔레포트.
- **FloorManager**: `PrepareNodeSpawns` → stage 목록에서 3개 선택. `RequestSelectNode(branchIdx)` → 선택 stage로. 단 stage 열거는 맵 active여야 하므로, 흐름1(맵 1회 진입) 전제에서 첫 진입 후 열거.
- **MR-W 코드 재사용**: 테마→맵(MapForTheme), CurrentMapId, ResolveSpawnPos(스폰포인트→PlayerSpawn로 이름만 교체) 등 대부분 유지.

## Acceptance criteria (구현 단계)
- [ ] 각 레벨맵에 stage 컨테이너 ≥2개(PlayerSpawn + 몬스터 인스턴스 포함) — Maker authoring
- [ ] 테마 맵 1회 진입 후 노드=stage 선택, 선택 stage의 PlayerSpawn에 플레이어 스폰
- [ ] 그 stage 몬스터가 배치 위치·종류대로 스폰, 다른 stage 몬스터는 안 나옴
- [ ] 사망 재시작·클리어 판정 정상(기존 ResetStage 흐름)
- [ ] 빌드 0에러, LEA-3004 등 런타임 에러 0(맵 active 상태 조회)

## 구현 상태 (2026-07-01)
- **코드 완료·라이브 검증** (StageManager/FloorManager):
  - StageManager: `EnterMapForTheme`(테마맵 1회 진입), `PrepareStages`(활성맵에서 Stage* 스캔→{SpawnPointPosition 좌표 + 몬스터 종류·위치} 캐시 후 프로토타입 전멸), `StartStageAt`(맵전환 없이 그 Stage 스폰). 스폰포인트 이름→`curSpawnX/Y` 월드좌표, `ClientStageReset(sx,sy)` 서버 산출좌표 전달(클라 맵조회 제거). 몬스터 종류=`GetComponent("script.EnemyRanged")` 추론. Stage 미캐시 시 RollComposition 폴백.
  - FloorManager: `RequestSelectTheme`→`EnterMapForTheme`, `OnMapReady`→NextNode, `PrepareNodeSpawns`=stageOrder에서 최대3, `RequestSelectNode`→`StartStageAt(Stage명)`.
  - MapBuilder 경로중첩 authoring 확인됨(`empty("Stage1/SpawnPointPosition")`, `placeModel("Stage1/MeleeEnemy",...)`).
- **검증(play, OrbisLevel 테스트 Stage1)**: PrepareStages stages=1 캐시 / StartStageAt Stage1 mobs=2 / 플레이어=Stage1 SpawnPointPosition(x=-4) 안착 / 몬스터 authored 위치·종류대로 스폰(E1 melee@2, E2 ranged@4) onGround. 빌드0에러, 내 코드 런타임에러0.
- **잔여(=사용자 Maker authoring)**: 3 레벨맵에 실제 Stage1/2/3 컨테이너 구성(현재 flat한 MeleeEnemy×20/RangedEnemy×14 + SpawnPointPosition을 Stage 아래로 그룹핑 + Stage별 SpawnPointPosition 1개). 그 후 3맵 전체 검증.
- ⚠ 잔존 LEA-3004(PhysicsSimulator, 맵 첫 진입 1회, 무해)는 이 흐름과 무관·별개 이월.

## 규약 (Maker authoring)
```
{Theme}Level (map root)
├── Stage1                    ← 컨테이너(빈 엔티티, 이름 "Stage"로 시작)
│   ├── SpawnPointPosition    ← 그 스테이지 플레이어 스폰 (자식 1개)
│   ├── MeleeEnemy (여러 개)   ← 실제 몹 모델 인스턴스 = 위치·종류 마커
│   └── RangedEnemy (여러 개)
├── Stage2 / Stage3 ...
```
- 런타임: 맵 진입 시 Stage*의 몬스터/스폰포인트를 캐시하고 원본 전멸 → 노드에서 Stage 선택 시 캐시 위치에 fresh 스폰. flat(비-Stage) 몬스터는 진입 시 전멸됨.

## Notes / decisions
- 🔗 MR-W(스폰포인트 기반): 이 티켓이 stage 기반으로 확장. 스폰포인트 이름 풀 로직은 stage 열거로 대체.
- 🔗 지난 세션 LEA-3004: 비활성 맵 조회가 원인이었음 → 흐름1(맵 1회 진입, 이후 active 유지)이 이를 구조적으로 회피. 별도 PhysicsSimulator 추가는 불필요할 수 있음(재검토).
- ⚠ 구현 전 stage 컨테이너 실제 구조(자식 이름 규약)를 Maker authoring과 합의해야 함. 지금은 설계만(사용자 지시 "어떻게 할지만").
