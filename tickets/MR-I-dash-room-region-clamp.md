---
id: MR-I
title: 대시 방-영역 클램프 (RoomRegion 논리 충돌 + 마커 authoring)
status: in-progress
owner: dust9826
area: mixed
touches:
  - RootDesk/MyDesk/Player/PlayerDash.mlua
  - RootDesk/MyDesk/Core/CombatPrimitives.mlua
  - RootDesk/MyDesk/Models/
  - map/
depends_on: []
branch: ""
created: 2026-06-20
updated: 2026-06-24
---

# 대시 방-영역 클램프 (RoomRegion 논리 충돌 + 마커 authoring)

## Goal
대시 거리 클램프를 터레인 충돌(풋홀드/타일 레이캐스트)에서 **"현재 방의 논리 영역(RoomRegion)" 기준**으로 바꾼다. 맵 모드와 무관한 순수 수학 충돌이라 MapleTile/SideView 차이·바닥-벽 오탐이 사라지고, 한 맵에 여러 방(비직사각형 포함)을 지원한다. 코드리뷰 finding #2·#3·#7을 함께 해소한다.

## 배경 (MR-S 결론)
- 표준 모드 = MapleTile 확정(MR-S). 대시 벽 정지는 터레인 충돌에 의존하지 않고 커스텀 논리 충돌로 간다.
- `CombatPrimitives:RaycastWallDistance`는 대시 전용 호출(`ComputeDashLength`에서만 사용) → 본 작업으로 대체/제거 가능.
- 게임필 결정: **대시는 "현재 방 논리 영역"에 클램프**(밧줄/장애물 물리 콜라이더는 Body 충돌로 별도). 영역과 물리 콜라이더는 분리.

## Acceptance criteria
- [ ] `RoomRegion` 추상화: `Contains(point)` + `ClampRay(origin, dir, maxLen)` 두 메서드. **RectRegion 구현 1개**(볼록 다각형은 필요 시 추가, 호출부 불변)
- [ ] 방 경계를 **데이터로 authoring** — 맵마다 마커/존 엔티티로 정의, 스크립트는 읽기만 (`.model` + `.map` 인스턴스)
- [ ] `RoomRegistry`(또는 동등): 맵의 마커들을 읽어 방 목록 보유 + `CurrentRoomFor(playerPos)` 제공
- [ ] `PlayerDash.ComputeDashLength`가 `currentRoom:ClampRay(...)`로 거리 산정 → `RaycastWallDistance` 호출 제거
- [ ] 사용하지 않게 된 `CombatPrimitives:RaycastWallDistance` 제거 (다른 호출 없음 확인)
- [ ] 대시가 현재 방 경계를 벗어나지 않음 + 방이 없는(미authoring) 맵에서도 안전한 폴백(기존 최대 사거리)
- [ ] 실측: MapleTile 맵에서 대시가 방 경계에 멈추고, 아래로 조준해도 죽지 않음(finding #2 해소), 방 밖으로 안 나감

## Subtasks (raycast 재설계, 2026-06-24)
- [x] 설계/리서치 멀티에이전트 워크플로우 + 적대적 검토 (wf_dadfd919-99b)
- [x] 런타임 raycast 프로브 — 클라 sim 동작 / passive Trigger 히트 / self-hit(플레이어 TriggerBox) / 그룹 필터 정확성 검증
- [x] GameConstants: `DashBlockGroup`, `DashFloorMinSin` 추가
- [x] CombatPrimitives: `OBBRayEntry`(회전 박스) + `ClampRayToCurrentRoom` raycast 블록 경로(그룹 존재 가드) + `ApplyFloorAimAssist`
- [x] PlayerDash: `ComputeAimDir`(접지 하향 조준 보정) 프리뷰/실행 동일 적용
- [x] 빌드 로그 0에러 확인 (refresh)
- [x] **(사용자)** Maker 프로젝트 설정 > Collision 에 `DashBlock` 그룹 생성 (Id=GUID `2fec08db23d947ff98e49fca06c9b359`)
- [x] `DashBlockRegion.model` authoring — Transform + TriggerComponent(passive, legacy false, CollisionGroup=DashBlock GUID, BoxSize 3×3), script 無. `roomregionmarker` 복제 기반.
- [x] map02에 테스트 블록 박스 `DashBlockTest` (6,1,0) 배치
- [x] **실측 검증(execute_script, play map02)**: clamp +x=3.500(블록 진입, self-hit 없음) / -x=8.139·+y=7.223(allow-box 공존) / ApplyFloorAimAssist 5케이스 전부 정확(접지+급하향만 보정, 공중·완만·상향 불변). 빌드 0에러.
- [ ] **남은 item 2**: 대시 후 플레이어 안 겹침(도착 위치 보정) + 예상 도착 반투명 미리보기 — 실측에서 실제 박힘/겹침 발생 시 진행(검토 권고: 발생 확인 후). 착지 고스트는 스프라이트 에셋 결정 필요.
- [ ] 인게임 체감 튜닝: 블록 박스 위치/크기(에디터 [Edit]) + DashWallMargin. (게임필, 눈으로)
- 보류(검토 YAGNI): foothold 스냅 / 방향투영 clearance — 실측 필요 시.

## Notes / decisions
- **확장은 이음새까지만(YAGNI):** ✅ RoomRegion 인터페이스 + 방=데이터(마커) 두 이음새. ❌ 임의 오목 다각형·내비메시·동적 방 병합·멀티 per-player 방(1인 1런 전제 유지)·방 그래프/잠금.
- **비직사각형:** 처음엔 Rect, 필요해지면 ConvexPolyRegion(레이 vs 변 반평면 클리핑 ~10줄) 추가. 호출부 안 바뀜.
- **현재 방 판정:** v1은 점-포함(`Contains`) 순회. 나중에 트리거 기반으로 교체 가능(한 곳만 수정).
- **밧줄/장애물:** 방 구분 + 플레이어 막기 = Body 물리 콜라이더로 별도 처리. 대시 영역(논리)과 분리. 단, 영역이 실제 벽 위치와 어긋나지 않게 authoring 규율 필요(마커를 벽에 맞춤).
- **center/foot(finding #3):** 이 작업에서 대시 기하 기준을 하나로 통일(중앙 권장)해 0.5유닛 불일치도 함께 정리.
- 슬랩(레이 vs AABB) 클램프 스케치:
  ```lua
  -- origin에서 dir로 방 사각형[minX,maxX]×[minY,maxY]을 처음 벗어나는 거리
  local tx = dir.x>0 and (b.maxX-origin.x)/dir.x or (dir.x<0 and (b.minX-origin.x)/dir.x or math.huge)
  local ty = dir.y>0 and (b.maxY-origin.y)/dir.y or (dir.y<0 and (b.minY-origin.y)/dir.y or math.huge)
  local exit = math.min(tx, ty)   -- L = min(커서거리, 최대사거리, exit - margin)
  ```
- **MR-A 연계:** 수제작 맵이 방 마커를 들고 옴. 마커 모델/포맷은 본 티켓에서 먼저 정의 → MR-A가 사용. (MR-A가 MR-I에 depends_on)

## 구현 완료 (2026-06-20)
- **CombatPrimitives**: `RegionContains`/`RegionClampRay`(rect 슬랩)/`ClampRayToCurrentRoom`(마커 열거+map.Name 캐시) 추가, `RaycastWallDistance` 삭제.
- **PlayerDash.ComputeDashLength**: `ClampRayToCurrentRoom`(발 기준)로 교체. #3 정합(발 기준 클리어런스).
- **RoomRegionMarker**: `Map/RoomRegionMarker.mlua`(@Component, 순수 태그) + `Models/Map/RoomRegionMarker.model`(model_id=`roomregionmarker`, Transform+**TriggerComponent**+script). 영역 = **TriggerComponent 콜라이더 박스**(BoxSize=가로/세로 월드유닛, ColliderOffset=중심, IsPassive=true→런타임 무충돌, IsLegacy=false). 스프라이트 의존 제거 — 에디터 Property Editor의 초록 박스를 [Edit] 드래그로 사이징(WYSIWYG, 픽셀/Scale 무관).
- region 표현 = 태그 테이블 `{kind="rect",cx,cy,halfW,halfH}` → 다각형 확장 시 분기만 추가.
- **검증(실측)**: 빌드 0에러. 런타임 단위검증 — contains(o/x), clampRight=5.0, clampDown=3.0, clampShort=2, **roomFallback=7(실맵 마커0 폴백)** 전부 통과. 로드 에러 0.
- **버그 수정 (2026-06-20, 첫 배치 테스트)**: 마커가 동작 안 함 → 근본원인 2개:
  1. **영역이 대시 사거리보다 훨씬 큼** — 배치된 영역 39×14.8유닛인데 `DashDistance=4`라 플레이 위치에서 경계에 도달 불가 → 클램프 미발동. **영역은 "대시를 멈추고 싶은 실제 벽/플레이 경계"에 맞춰 타이트하게** 잡아야 함(과대 영역은 무의미).
  2. **스프라이트 크기 의존**(128px=1.28유닛 → Scale≠유닛) → 시각화를 **TriggerComponent 콜라이더 박스로 전환**(사용자 요청). BoxSize가 곧 월드유닛 영역, 스프라이트/Scale 무관. 스프라이트 리소스(`cbf8…`)는 삭제.
  - map02 마커를 콜라이더 구성으로 재배치(placeModel), BoxSize=26×12, Position(2.25,2.5), Scale=1, IsPassive=true, IsLegacy=false.
  - **실측 검증(execute_script, 실제 배치 마커)**: markerCount=1, BoxSize=26×12, passive/legacy 정상, nearRightEdge=2.25(경계 15.25서 정지), center=4(무클램프), nearLeftEdge=1.75, outside=4(폴백), **LWA-3019 경고 없음**. 전부 정확.
- **authoring 규칙(중요)**: 마커 배치 → TriggerComponent **BoxSize = 방 가로·세로(월드유닛)**, Position = 방 중심(에디터 [Edit] 초록 박스 드래그로 사이징). 영역은 대시가 멈춰야 할 경계(=플레이 벽)에 맞춤 — 너무 크게 잡으면 4유닛 대시가 경계에 못 닿아 효과 없음.

## 다음 세션 할 일 (바로 진행 예정) — 멈추는 위치/마진 튜닝
현재 인게임 동작은 "적당히 됨". 대시가 **멈추는 위치/마진**이 거슬려 다듬어야 함 (게임필).
- **조정 knobs**:
  - `GameConstants.DashWallMargin`(현재 `0.4`) — `PlayerDash.ComputeDashLength`에서 클램프 거리에서 빼는 값. 키우면 벽 더 앞에서, 줄이면 벽에 더 붙어 정지.
  - map02 마커 **BoxSize/Position** — "벽"의 실제 위치. 경계가 시각 벽과 어긋나면 BoxSize(26×12)/Position(2.25,2.5)을 미세 조정 (collider [Edit] 초록 박스로).
  - (필요 시) `CombatPrimitives.RegionClampRay` 자체 로직.
- **진행 방법**: play → 끝쪽으로 대시 → 멈춤 지점 vs 벽 관찰 → DashWallMargin / 마커 bounds 튜닝 → 반복. (체감 위주, log보다 눈으로)
- 이 항목 끝나면 MR-I review→done.

## 방향 전환 (2026-06-24) — raycast 콜라이더 재설계 + 조작감 3종
사용자 결정: 클램프 판정을 "가능 영역(감싸는 박스)" 모델에서 **콜라이더 기반 "대시 불가 지역"**으로 전환하고, MSW **네이티브 raycast**(`CollisionSimulator:Raycast`)로 판정. 추가로 조작감 2종.

**확정 사항 (locked):**
- 불가 지역 = MSW 네이티브 raycast로 감지. `_CollisionService:GetSimulator(map):Raycast(group, origin, dir, L)`.
- Raycast는 **충돌 Component만 반환**(거리 없음) → 맞은 콜라이더의 박스 1개로 **OBB(회전 지원) 진입거리** 계산해 정지거리 산정.
- 불가 지역 authoring = **별도 모델**(기존 allow-box RoomRegionMarker와 분리). allow-box(기존 math 포함 클램프)는 공존 가능.
- `PlayerDash.ComputeDashLength` 호출부 시그니처 불변, 내부만 교체.
- **미검증(런타임 프로브 필요):** 기존 TriggerComponent(IsPassive=true) 박스가 raycast에 잡히는지. 안 잡히면 콜라이더 구성(non-passive Trigger / PhysicsCollider / 커스텀 그룹) 재결정.

**3개 작업 항목:**
1. **콜라이더 raycast로 대시 불가지역 판정** (위 핵심).
2. **대시 후 플레이어 안 겹침**: 대시 후 예상 도착 위치를 반투명 표시 + 벽/바닥에 박히지 않게 도착 위치 보정(벽이면 위로/뒤로, 바닥 조준이면 바닥에 붙임).
3. **바닥 대시 조작감**: 바닥에서 아래로 조준 시 raycast만 쓰면 대시가 아예 안 되는 문제 → 마우스 x/y 중 최대가 되도록 각도 보정(접지+하향 조준 게이트).

**진행 순서:** 멀티에이전트 설계 워크플로우(run wf_dadfd919-99b) → 런타임 raycast 프로브 → 설계 승인 → 구현 → 검증.

**보존(이전 구현):** 아래 "구현 완료 (2026-06-20)"의 RoomRegion math 클램프(`RegionContains`/`RegionClampRay`/`ClampRayToCurrentRoom`)는 allow-box 경로로 유지. block 경로만 raycast로 추가.

## 런타임 프로브 결과 (2026-06-24, play map01)
- ✅ 클라이언트에서 `_CollisionService:GetSimulator(map)` + `Raycast` 정상 동작.
- ✅ **passive TriggerComponent(IsPassive=true)도 raycast에 잡힘** → 기존 마커 패턴(스프라이트 無, 콜라이더 박스) 그대로 재사용. non-passive·PhysicsCollider·PhysicsRigidbody 불필요.
- ⚠️ 플레이어 자신이 `TriggerBox` 그룹(비-passive)에 속함 → TriggerBox로 raycast하면 **플레이어 자기 콜라이더에 먼저 맞음**(self-hit). 적/allow박스도 TriggerBox 공유 → 모호.
- ✅ **그룹 필터링이 정확**: 플레이어가 안 속한 그룹으로 마커 group을 바꾸면 발 원점에서 쏴도 마커만 맞고 플레이어엔 안 맞음(PROBE-E, Climbable 대역 검증). 미등록 그룹명은 필터 안 됨(아무거나 맞음) → 실제 등록 그룹 필수.
- `CollisionGroups` 전역 = Default/TriggerBox/HitBox/Interaction/Portal/Climbable. **사용자 결정: 전용 `DashBlock` 그룹 신규 생성**(Maker 프로젝트 설정 > Collision). 블록 마커 `TriggerComponent.CollisionGroup = DashBlock`.

## 최종 구현 스펙 (확정)
**GameConstants** — 추가: `DashBlockGroup="DashBlock"`(string), `DashFloorMinSin=0.2588`(=sin15°). `DashWallMargin`(0.4) 유지(단일 차감).
**CombatPrimitives**:
- `OBBRayEntry(hitComp, origin, dir, maxLen)`: hit 콜라이더의 Transform(WorldPosition/Scale/**WorldZRotation**)+Trigger(BoxSize/ColliderOffset)로 OBB 슬랩 진입거리(tmin) 계산. **회전 박스 지원**(레이를 박스 로컬로 변환). origin이 박스 안/뒤면 maxLen.
- `ClampRayToCurrentRoom`: `result=maxDist` → (1) 기존 allow-box math(포함 시 이탈거리) → (2) **신규** `sim:Raycast(DashBlockGroup, origin, dir, result)` 맞으면 `OBBRayEntry`로 진입거리 → 전부 `min`. `DashWallMargin`은 호출부(`ComputeDashLength`)에서 한 번만 차감(불변).
- `ApplyFloorAimAssist(dir, onGround, facingX)`: onGround AND `dir.y < -DashFloorMinSin`일 때만 dir.y를 -DashFloorMinSin으로 클램프하고 수평성분 재정규화(`hx=sqrt(1-minY²)`). dir.x==0이면 `facingX`로 평탄화. 공중/상향/수평/SideView 불변.
**PlayerDash**: `UpdateAimPreview`·`TryDash`에서 `DirectionTo` 직후 `ApplyFloorAimAssist` 호출(onGround=`RigidbodyComponent:IsOnGround()`, facingX=`MovementComponent:IsFaceLeft()`→±1). 프리뷰·실행 동일 적용.
**모델**: `Models/Map/DashBlockRegion.model`(model_id `dashblockregion`) = Transform + TriggerComponent(IsPassive=true, IsLegacy=false, **CollisionGroup=DashBlock**, BoxSize 기본). script.RoomRegionMarker **미포함**(allow 열거에 안 잡히게). 스프라이트 無(콜라이더 박스 WYSIWYG).
**보류(검토 YAGNI)**: foothold 착지 스냅 / 방향투영 clearance / 착지 고스트(item2 시각)·tint → 실측에서 필요 확인 시 추가. 고스트는 맨 마지막, foot 기준.
**검증**: 그룹 생성 후 refresh → map02에 dashblockregion 1개 배치 → play → 발 원점 raycast 클램프 + 바닥 하향조준 어시스트 실측.

## foothold 조준보정 제거 (2026-06-24, 이어서)
- 사용자 판단: 대시가 foothold/바닥 기준으로도 막히는 느낌 → 접지 하향 조준 보정 **일단 제거**.
- `PlayerDash.ComputeAimDir`이 `ApplyFloorAimAssist` 호출을 빼고 **raw 커서 방향**(`DirectionTo`)만 반환. 프리뷰·실행 공통. `CombatPrimitives:ApplyFloorAimAssist`는 순수함수로 보존(복원 1줄).
- 실측(play map02, execute_script): onGround=true에서 직하향→(0.000,-1.000), 급하향→(0.179,-0.984) — 보정 안 걸림 확인. 빌드 0에러.
- map02 테스트 블록(발밑 가로 슬랩 폭4·높이0.5)은 **그대로 둠**(사용자).
- **DashWallMargin 0.4 → 0.0** (`GameConstants`) — 벽/블록 면에 딱 붙어 정지. 복원 시 0.4.
- 실측(사용자 라이브 대시): 위(−0.18,0.98)=len4.00 / 아래(0.06,−1.00)=len3.61 / 우하향(0.99,−0.16)=**len0.01**(발밑 슬랩 즉시 히트). 마진0·보정無 확인. 빌드 0에러.
- 비고: 아래로 조준 시 발밑 DashBlock 슬랩이 있으면 raycast가 즉시 맞아 대시 0거리(위 len0.01) — 일반 맵엔 바닥이 foothold(DashBlock 아님)라 무관. map02 슬랩은 유지 결정이라 그 맵에선 아래 대시 막힘 지속. 체감 보고 필요 시 보정 복원/대안 검토.

## 디버그 기즈모 추가 (2026-06-24, 이어서)
대시 디버깅용 시각화 (사용자 요청). **항상 켜둔 디버그 모드**(`GameConstants.DashGizmoDebug`).
- **신규** `Player/PlayerDashGizmo.mlua`(@Component, ClientOnly): 매 프레임 그림 — (1) DashBlock 불가지역 박스 4-엣지 외곽선(빨강, 회전 지원), (2) 최대 사거리 원(기존 DashRangeCircle 재사용), (3) 실제 대시 레이(발 원점→도착, 초록)+원점(시안)/도착(노랑) 점. 조준 중=라이브(발 기준), 대시 후=실제 경로 잔상(DashGizmoHold 1.5s).
- 엔티티는 **기존 빔/점/원 스프라이트 모델 재사용**(새 에셋 0). PlayerBootstrap이 게이팅 스폰: 레이1+점2+엣지풀(DashGizmoMaxBlocks×4=12) = 15개. PlayerDashGizmo 컴포넌트도 게이팅 부착.
- GameConstants 추가: `DashGizmoDebug/RayName/OriginName/EndName/EdgePrefix/MaxBlocks(3)/Hold(1.5)/EdgeThick(0.12)/RayThick(0.2)/DotScale(0.35)`.
- 블록 열거 = `TriggerComponent.CollisionGroup.Id == DashBlock` 필터(맵별 캐시). DashBlockRegion은 RoomRegionMarker 미포함이라 그룹 Id로 식별.
- **실측 검증(play map02)**: 블록 1개→엣지4 정확 배치(top/bottom/left/right, scale=길이/빔폭 일치), 사거리원 center+3.51, 대시(dir 0.85,0.53 len4.0)→레이 발원점→도착(3.39,1.49) 정확, idle 시 숨김. 빌드 0에러.
- 경고 `LWA-3048`(런타임 AddComponent deprecation) — combat 컴포넌트 공통, 기능 무해.
- **MR-D 제거 대상**: `DashGizmoDebug=false`로 끄거나, PlayerDashGizmo.mlua + PlayerBootstrap EnsureDashGizmo/AddComponent + GameConstants 기즈모 상수 제거.

## 대시 도착 발판 스냅 (2026-06-24, 이어서)
대시 도착 시 **발(하체)만 발판 표면 아래로 살짝 묻히고 상체는 안 걸칠 때** 판정 우위로 발판 위에 올림. MapleTile·도착지점 한정.
- `CombatPrimitives:SnapFootToFoothold(map, footX, footY, maxSnap)`: 발에서 위로 maxSnap 지점부터 아래로 `FootholdComponent:Raycast` → 발판 표면이 발보다 위(묻힘)이고 깊이 ≤ maxSnap이면 `Foothold:GetYByX`로 표면 Y 반환. 수직 풋홀드(벽) 제외.
- `PlayerDash.EndDash`: dashIsSideView==false일 때만 호출, 스냅되면 `DashMoveTo`로 Y만 올림. (도착지점 한정 — 이동 중엔 미적용)
- `GameConstants.DashFootholdSnap = 0.4` (콜라이더 높이 0.7의 절반쯤; 이보다 깊으면 상체까지 묻힘=벽 취급해 스냅 안함). 튜닝 knob.
- **실측 검증(play map02, 138 풋홀드)**: A(표면 0.2 아래)→표면으로 스냅, B(1.0 아래)→불변, C(0.2 위)→불변, D(표면)→불변. 빌드·diagnose 0에러.
- 비고: 디버그 기즈모 잔상은 raw 대시 경로(스냅 전)를 표시 — 스냅은 도착 후 Y 보정이라 별개. 체감 후 maxSnap 조정 가능.

## 접지 스텝오버 + 블록 도착 스냅 (2026-06-24, 이어서)
접지 시 낮은 방해물(DashBlock)은 대시로 넘어가고, 높은 벽은 그대로 막히게. + 낮은 블록에 도착이 박히면 블록 위로 올림. (사용자: 스텝오버 방식, 기준 높이=플레이어 중앙 0.5)
- `GameConstants.DashStepOverHeight = 0.5` knob.
- `CombatPrimitives.ClampRayToCurrentRoom`의 `blockGrace` 파라미터(접지 여유, 스텝오버+시작여유 통합): ① 블록 raycast 원점 Y를 이만큼 올림(낮은 장애물 통과) ② **entry<blockGrace 인 블록은 클램프 무시**(벽에 붙거나 겹쳐도 안 막힘 = 여유만큼 밖에서 시작한 효과). allow-box 불변. 공중(0)은 기존 동작.
- `PlayerDash.ComputeDashLength`: 접지(`RigidbodyComponent:IsOnGround()`)면 `blockGrace = DashStepOverHeight`, 공중이면 0. 프리뷰·실행·기즈모 공통(ComputeDashLength 경유).
- **DashStepOverHeight 0.5 → 0.35로 하향**(체감상 0.5 과함, 70%). 스텝오버·시작여유·블록 도착스냅 모두 이 값 사용.
- **실측(2026-06-24 추가)**: 벽 겹침 탈출 origin(0,-1.0)+x → noGrace 0.000 / withGrace(0.35) 4.000 ✓. 하향대시 0.583(0.35 기준) 정상 클램프. 빌드·diagnose 0에러.
- 한계(검토): 블록 raycast가 첫 히트만 봄 → 무시된 가까운 블록 뒤의 벽은 미감지 가능(단일 블록 시나리오 위주라 허용).

## 벽 진입 방지 — 방향성 클램프 (2026-06-24, 이어서)
이전 grace(entry<grace 무시)는 겹쳤을 때 **아무 방향이나** 통과시켜 벽 안으로 더 들어갈 수 있었음 → "겹치면 바깥으로만" 으로 교체.
- **신규** `CombatPrimitives.BlockClampEntry(hit, origin, dir, maxLen)` (OBB/회전 지원):
  - origin이 블록 **밖** → 슬랩 진입거리(벽 앞 정지, **진입 불가**). 면과 평행+경계 밖이면 maxLen(빗나감).
  - origin이 블록 **안** → 가장 가까운 면 바깥 노멀·dir 내적>0(바깥)이면 maxLen(탈출 허용), 아니면(안쪽/평행) **0**(더 깊이 금지).
- `ClampRayToCurrentRoom` 블록 경로가 `OBBRayEntry`+grace조건 → `BlockClampEntry`로 교체. `blockGrace`는 이제 스텝오버 Y올림 용도만(공중=0).
- **실측(play map02)**: 벽 안 up=4.00/+x=0.00/down=0.00, 밖에서 진입(down)=0.350(면 앞 정지), 접지 수평 스텝오버=4.000. 전부 정확. 빌드·diagnose 0에러.

## 벽 측면 도착 마진 (2026-06-24, 이어서)
벽에 막혀 정지할 때 플레이어가 벽에 안 박히게 마진을 두고 정지. **측면(벽)에만**, 바닥/천장(위·아래 면)엔 미적용(착지 스냅 담당 → 하향 대시 0거리 회귀 방지).
- `BlockClampEntry`에 `wallMargin` 파라미터 + 진입 면 축 추적(`entrySide`). 밖에서 진입 시 진입 면이 x축(측면=벽)이면 `entry -= wallMargin`(0 하한). y축(위/아래)이면 마진 0.
- `GameConstants.DashWallMargin` 0.0 → **0.35**(플레이어 반폭 0.33+여유)로 재활용. `ClampRayToCurrentRoom`이 BlockClampEntry에 전달.
- `PlayerDash.ComputeDashLength`의 기존 일괄 `- DashWallMargin` 제거(이중 적용 방지; 마진은 이제 측면 블록 전용).
- **실측(play map02, 세로 벽 center(-9.13,2.35) 폭2·높이8)**: 벽 측면 1.0 접근 → 0.650(마진 0.35 앞 정지) / 바닥 윗면 하향 → 0.350(마진 없음). 빌드·diagnose 0에러.
- 비고: 마진은 dir 방향 스칼라라 대각 진입 시 근사. 체감상 부족/과하면 DashWallMargin만 조정.

## 겹친 블록 관통 버그 수정 (2026-06-24, 이어서)
**증상**: 벽에 비비며(겹친 채) 대시하면 연결된 바닥이 뚫림. **근본원인**: `CollisionSimulator`엔 `RaycastAll`이 없고 `Raycast`(첫 히트 1개)만 → 벽에 겹친 채 바깥 방향 대시 시 벽만 반환→탈출 허용(무시)→연결된 바닥 미조회→관통.
- **재현 데이터**: 벽 x[-10.13,-8.13]·바닥 x[-10.68,9.78] y top -0.64 (겹침). origin(-9.0,-0.29) 우하향 → 기존 ClampRay=4.000(관통), 바닥 단독 BlockClampEntry=0.500.
- **수정**: 단일 `sim:Raycast` → **전체 DashBlock 콜라이더 열거(`BuildBlockColliders`, 맵별 캐시) 후 각각 `BlockClampEntry` min**. 겹친 벽은 탈출(무시)돼도 바닥은 따로 평가 → 0.5로 클램프.
- **실측(play map02)**: [FIX] 겹침 우하향 4.0→0.500 / [REG] 벽측면 1.023·바닥하향 0.340·접지수평 4.000. 빌드·diagnose 0에러.
- 한계: 블록 많은 맵에서 매 클램프마다 전체 루프(캐시됨, 보통 소수). 필요 시 공간분할.
- `CombatPrimitives.SnapFootToBlock`: 도착 시 발에서 위로 maxSnap 지점부터 아래로 DashBlock raycast → OBB 진입점(블록 윗면)이 발보다 위·깊이<maxSnap이면 올림. **entry==0(원점이 블록 내부=블록이 snap보다 높이 솟음=상체까지 묻힘)은 거부**(깊은 박힘 스냅 안함).
- `PlayerDash.EndDash`: 발판 스냅 + 블록 스냅 중 더 높은 표면으로(max). MapleTile 한정.
- **실측 검증(play map02, slab top −0.64)**: 하향대시 clamp noStep=0.000→withStep(0.5)=0.833 / 블록스냅 얕음(−0.89→−0.64)·깊음(−1.5→불변)·발판스냅 4케이스 전부 정확. 빌드·diagnose 0에러.

## Verify
- Maker `play` → 대시를 방 경계·바닥 방향으로 쏴서 클램프 정상 + 방 밖 이탈 없음 → `logs` 에러 0. 미authoring 맵 폴백 확인.
- (완료) 기하/열거/폴백 로직은 execute_script 단위검증으로 통과 + 실제 배치 마커로 클램프 확인. **잔여: 멈춤 위치/마진 체감 튜닝(다음 세션) + MR-A 다맵 마커 배치.**
