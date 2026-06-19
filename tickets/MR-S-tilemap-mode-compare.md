---
id: MR-S
title: 타일맵 모드 비교 스파이크 (MapleTile vs SideViewRectTile)
status: in-progress
owner: dust9826
area: map
touches:
  - map/
  - RootDesk/MyDesk/Models/
  - RootDesk/MyDesk/Player/
depends_on: []
branch: ""
created: 2026-06-19
updated: 2026-06-19
---

# 타일맵 모드 비교 스파이크 (MapleTile vs SideViewRectTile)

## Goal
같은 월드 안에 **MapleTile(=0)** 맵과 **SideViewRectTile(=2)** 맵을 각각 하나씩 빠르게 만들어 플레이어 조작감(이동/점프/대시/전투 위치잡기)을 직접 비교한다. 멘토링/회의 전까지 두 모드를 모두 만들어 비교 자료로 쓰고, **표준 모드는 회의 후 확정**한다. 이 결정이 MR-A(맵 양산)를 가른다.

## Acceptance criteria
- [ ] 같은 월드에 비교용 맵 2개 존재: MapleTile 1개 + SideViewRectTile 1개
- [ ] 각 모드에서 플레이어가 정상 이동·점프·대시 (모드↔Body 매칭 정확, `[LEA-3004]`·"안 움직임" 없음)
- [ ] 두 맵을 오가며 조작감 비교 가능 (포털/디버그 이동 등)
- [ ] 비교 소감/장단점을 이 티켓 Notes에 기록 (회의 자료)

## Subtasks
- [x] 현행 4개 맵 TileMapMode 확인 → 전부 MapleTile(0). map01을 MapleTile 비교 대상으로 사용 (신규 제작 불필요)
- [x] 코드의 MapleTile 결합도(=SideView 마이그레이션 비용) 감사 → 아래 표로 정리 (회의 자료)
- [x] 비교용 디버그 도구 작성: `RootDesk/MyDesk/Debug/DebugMapToggle.mlua` (F8로 맵 A↔B 토글). LSP 통과, 런타임 검증은 SideView 맵 생성 후로 보류
- [ ] **[사용자/Maker]** SideViewRectTile 비교 맵 1개 생성 (아래 "Maker 설정 단계" 참조)
- [ ] **[사용자/Maker 직후]** map B를 sector entries에 등록 + `DebugMapToggle.MapB` 인스펙터에 맵 이름 입력
- [ ] refresh → play → 두 맵에서 이동/점프/대시 실제 조작 + `logs` 에러 확인 (DebugMapToggle 검증 동시)
- [ ] 비교 소감(조작감 장단점) 본 Notes에 추가 → 회의에서 표준 모드 확정

## Notes / decisions

### 핵심 제약 (왜 협업 작업인가)
신규 SideViewRectTile 맵 생성 · TileMapMode 전환 · 타일 페인팅은 **전부 Maker 에디터에서 사용자가 직접** 하는 작업이다. AI는 `.map` JSON으로 모드를 바꾸거나 맵을 만들 수 없다 (platform.md §4 / builder-protocol.md §1.6). → 본 스파이크는 "AI 분석/준비 + 사용자 Maker 작업"의 협업 형태.

### 현황
- map01~04 전부 MapleTile(mode 0), 타일 672 / 풋홀드 71 동일 (클론). **MapleTile 비교 대상은 map01 그대로 사용.**
- 적 모델 4종(MeleeEnemy/RangedEnemy/BossEnemy/TrainingDummy) 전부 `RigidbodyComponent`만 보유.

### SideView 표준화 시 마이그레이션 비용 (코드 감사 결과 — 회의 핵심 자료)
| 시스템 | 현재 결합 | SideView 전환 영향 | 비용 |
|---|---|---|---|
| 플레이어 이동/점프 | DefaultPlayer가 3개 Body 자동 활성 | 자동 전환됨 | ✅ 무비용 |
| 대시 이동 | `MovementComponent:SetWorldPosition` (Body 무관) | 그대로 동작 | ✅ 무비용 |
| **대시 벽 정지** | `CombatPrimitives:RaycastWallDistance` = **풋홀드 RaycastAll + IsVertical** | SideView엔 풋홀드 없음 → **무에러로 벽 정지 무력화(벽 통과)**. RectTile 충돌 기반으로 재작성 필요 | ⚠️ 중 |
| **적 4종 Body** | 전부 `RigidbodyComponent` | SideView에서 `[LEA-3004]` 또는 공중 부유 → 전부 `SideviewbodyComponent` 추가 | ⛔ 모델 4종 수정 |
| **스폰/리셋 좌표** | StageManager 스폰점 y≈0.4, 리셋 y=0.3 (풋홀드 상단 하드코딩) | 타일 그리드 기준 재조정 필요 | ⚠️ 좌표 재튜닝 |
| 전투 판정(원/선분) | WorldPosition 기하 (CircleOverlap/PointSegmentDistance) | 맵 무관 | ✅ 무비용 |
| 맵 전환 | `PlayerComponent:MoveToMapPosition(mapId, pos)` | 동일하게 동작 | ✅ (비교 텔레포트에 활용) |

요약: **플레이어 조작감 자체는 SideView로 옮겨도 거의 그대로**(DefaultPlayer 자동 Body). 비용의 핵심은 (1) 대시 벽 정지 재작성, (2) 적 모델 Body 추가, (3) 스폰 좌표 재튜닝.

### Maker 설정 단계 (사용자 작업 — SideView 비교 맵 만들기)
1. Maker Hierarchy → 새 맵 생성(또는 map01 복제) → 맵 엔티티 우클릭 → **"Switch SideViewRectTileMap"** 선택 (모드 2로 전환, 지형 리셋됨).
2. RectTile 타일셋으로 바닥/벽 타일을 페인팅 (평지 + 벽 몇 개 — 대시 벽 정지 비교용).
3. 시작 지점 근처에 타일이 깔려 있는지 확인(중력 때문에 빈 공간이면 추락).
4. 저장 → 나에게 알려주면 `refresh` 후 검증 진행.

### 비교용 디버그 도구
- `RootDesk/MyDesk/Debug/DebugMapToggle.mlua` (@Logic, 신규). **F8** = 비교 맵 A↔B 즉시 토글.
- 인스펙터: `MapA`(기본 "map01") / `MapB`(SideView 맵 이름 입력) / `SpawnPos`(도착 좌표).
- 맵 전환은 서버 권위(`MoveToMapPosition`)로 위임. 코어 파일 미수정 · 독립 동작 (InputRouter 컨텍스트 무관).
- ⚠️ 디버그 전용: 스테이지 진행 중 토글하면 StageManager 상태와 어긋날 수 있음. 비교용으로만 사용. 릴리스 시 제거(MR-D).
- 검증 보류: SideView 맵이 아직 없어 런타임 play 검증은 맵 생성 후 수행.

### 진행 로그 (2026-06-20, 실측 검증)
- 사용자가 Maker에서 mapSV 생성 + SideViewRectTileMap 전환 + `SVTilemap` 타일셋에 `Ground` 타일 추가 완료.
- **추락 버그 원인 = 타일 `IsCollidable=false`** (사용자가 immovable 미설정). AI가 `.tileset`의 `datas[0].IsCollidable`을 true로 직접 수정 → refresh → 해결.
- **SideViewArenaBuilder 검증 통과**: OnBeginPlay에서 `BoxFill("Ground")`로 74타일(바닥+벽+발판2) 자동 생성, 서버·클라 양쪽 TileCount=74.
- **핵심 조작감 실측 검증(execute_script+keyboard_input)**:
  - 바닥 충돌: 플레이어 (0.5,2)→착지 y≈0.001, IsOnGround=true ✓
  - 걷기: →키 800ms, x 0.5→1.71 (+1.2유닛), 접지 유지 ✓
  - 점프: y 0.001→정점 0.91→착지 0.001 ✓
  - 스크린샷: 갈색 벽돌 타일 다층 아레나 렌더 확인, 하늘 배경.
- 좌표계: cell(x,y)→world(x+0.5, y+0.5). 바닥 윗면 world y≈0.
- **적 SideView 대응 완료**: MeleeEnemy/RangedEnemy 모델에 `SideviewbodyComponent` 추가(Rigidbody 유지 → 양쪽 모드 호환). SideViewArenaBuilder가 mapSV에 melee/ranged 1기씩 스폰.
  - 실측: SVE_Melee(4,0)/SVE_Ranged(-4,0) 둘 다 **onGround=true** (바닥에 섬), **RangedEnemy 투사체 발사 작동**. 피격(EnemyHealth/CombatPrimitives)은 위치 기반이라 SideView에서도 동작.
  - 잔여 마이그레이션 비용: 근접 적 **추격 이동**은 Rigidbody.MoveVelocity + FootholdComponent:Raycast 기반이라 SideView에서 정지(피격 타겟으론 동작). 완전 이식 시 EnemyMelee/EnemyRanged 이동부를 body-agnostic(Sideviewbody + RectTile 지면검사)로 재작성 필요.
- 정상 비교 플로우: **map01을 연 채 Play** → 테마/노드 → map02 전투(Combat 컨텍스트) → **F8로 mapSV 이동**(Combat 유지) → SideView에서 이동/점프/대시/전투 비교 → F8로 복귀. (mapSV에서 직접 Play하면 테마 팝업이 떠 시작 플로우가 꼬임 — mapSV는 start 맵 아님.)
- **일반 스테이지 = mapSV로 전환**: `GameConstants.MapNormal = "mapSV"` (원복: "map02"). ArenaBuilder의 적 스폰은 비활성(StageManager가 적 담당) — 타일만 생성.
  - 실측 정상 플로우: 테마→노드 → "stage START type=normal map=mapSV" → player (0,0) 바닥, tileCount=74, **적 4기(E1~E4) 전부 onGround=true**, 컨텍스트 Combat. 즉 Play→테마/노드 클릭만으로 SideView 전투 진입.
### 잔여 항목 처리 완료 (2026-06-20, 실측)
- **대시 벽 정지 (CombatPrimitives.RaycastWallDistance)**: 풋홀드 레이캐스트(MapleTile) + RectTile 충돌타일 레이마치(SideView) 분기 추가. 실측: x=9→우 2.0(벽 정지)/x=0→우 5.0(개방, 오탐0)/x=-9→좌 1.2(벽 정지). MapleTile 경로 불변.
- **적 추격 (EnemyMelee/EnemyRanged.ChaseToward)**: 맵 타입 분기 — SideView=`MovementComponent:MoveToDirection`(직접 Sideviewbody.MoveVelocity는 비-플레이어에 무효임을 실측 확인), MapleTile=기존 Rigidbody.MoveVelocity+풋홀드 낭떠러지 정지(불변). 적 모델에 Sideviewbody+MovementComponent 추가(Rigidbody 유지). 실측: 멜리가 플레이어 쪽으로 거리 좁혀 공격범위 도달(추격 동작), 원거리 투사체 발사, 라이브 적 에러 0.
- `GameConstants.EnemyChaseSpeed=2.0` 신설(SideView 추격 속도, 튜닝용).
- 남은(선택): 시각 패리티 미세 튜닝(스폰 좌표/배경), 멜리 추격 속도 밸런싱(EnemyChaseSpeed).
- ⚠️ map01.map diff 268줄은 Maker 재저장 부동소수점 노이즈(모드0·구조 동일) — 기능 변화 아님.

### 비교 편의: 스테이지 노드에서 타일맵 선택 (2026-06-20)
- **노드 선택 팝업을 SV/MV 선택기로 전환** — 매 일반 스테이지 직전 "MapleTile (발판)" / "SideView (타일)" 버튼으로 타일맵 모드 선택.
- 데이터: `GameConstants.NormalMapChoice`(@Sync) 신설 → `MapIdForStage("normal")`가 반환. 와이어링: `FloorManager.RequestSelectNode(1)`=map02(MapleTile) / `(2)`=mapSV(SideView).
- UI: `NodeSelectGroup.ui` BtnNode1="MapleTile (발판)" / BtnNode2="SideView (타일)" / BtnNode3 숨김, 타이틀 "타일맵 선택 — 조작감 비교". (UIBuilder, lint clean)
- 실측: 노드 branch1 → "stage START map=map02", NormalMapChoice=map02, playerMap=map02 ✓. branch2 → mapSV(기검증).
- 플레이 흐름: Play → 테마팝업(아무거나) → **노드팝업에서 MapleTile/SideView 택1** → 해당 타일맵에서 전투 → 클리어/사망 후 다음 노드에서 다시 선택 가능 → 직접 A/B 비교.

### 대시 개선 3종 (2026-06-20)
- **중앙 시작**: 방향/사거리/조준 미리보기/마커/사거리원 모두 플레이어 중앙(pos.y+PlayerCenterYOffset) 기준. 이동 원점은 발(엔티티 원점) 유지. 실측: 조준 시 원/미리보기 y=0.5(중앙), 대시 dir/len 중앙 기준.
- **SideView 부드러움**: 대시 이동을 `DashMoveTo`로 분기 — SideView=`Sideviewbody:SetWorldPosition` + 매프레임 `MoveVelocity=0`(프레임간 중력 누적 제거→지터 방지), MapleTile=기존 `MovementComponent:SetWorldPosition`(불변). 실측: SideView 대시 (0.5,0)→(3.5,0) 정확 착지, **Y 드리프트 0**.
- **최대 사거리 원**: `DashRangeCircle.model`(SpriteRUID=12070f3a..., OrderInLayer=49, 기본 Enable=false) 신설, PlayerBootstrap이 플레이어 자식으로 스폰. 조준 중 중앙에 지름 2×DashDistance(=8유닛, scale 3.51)로 표시. 실측: circleY=0.5, scale=3.51, enabled=true.
- ⚠️ 사용자 눈 확인 필요: (1) SideView 대시 지터 실제로 사라졌는지(체감), (2) 사거리 원 스프라이트(임시 검색 에셋 228×228)가 깔끔한 링으로 보이는지 — 아니면 RUID 한 줄 교체.

### MSW 규칙 메모
- 모드↔Body: MapleTile→RigidbodyComponent / SideViewRectTile→SideviewbodyComponent. 오짝짓 시 무에러로 안 움직이거나 LEA-3004.
- 로드한 레퍼런스: msw-general + platform.md + platform-maple.md + platform-sideview.md + entity.md + builder-protocol.md + msw-scripting + verify-checklist.

## Verify
- Maker `play` → 두 맵에서 각각 이동/점프/대시 실제 조작 → `logs`로 에러 없음 확인.
