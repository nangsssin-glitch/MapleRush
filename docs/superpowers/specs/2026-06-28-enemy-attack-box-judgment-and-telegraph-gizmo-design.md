# 적 공격 박스 판정 + 예상 공격 기즈모 — 설계

- 날짜: 2026-06-28
- 작성: dust9826 (+ Claude)
- 관련 티켓: MR-G (적 AI 상태패턴 정비 — 공격 모션/판정 분리)와 인접. 본 작업은 "공격 판정 형태" 변경 + 디버그 시각화.

## 목표

적·플레이어 공격의 명중 판정을 **자기 중심 원**에서 **사각형(box)**으로 바꾼다:
- 적 근접(평타·보스 slam) = 적이 바라보는 방향 앞으로 뻗는 **전방 박스**.
- 보스 광역(redSmash) = 가로로 넓고 세로로 낮은 **중앙 박스**(점프/위-대시로만 회피).
- **플레이어 평타** = 커서가 있는 **좌/우 방향 전방 수평 박스**(커서로 앞뒤 전환). 기존 360° 원 → 방향성 박스.

더불어 모든 공격의 **예상 위치를 디버그 기즈모로 정확히** 표시한다 — 근접/광역/플레이어=박스, 원거리=회전 직사각형 레인(멀티샷이면 여러 갈래).

**모든 박스는 AABB**(적은 좌/우만 봄, 플레이어는 커서 좌/우 → 수평) → overlap 수학은 **box-circle + box-box(둘 다 AABB)** 둘만 필요. 회전(OBB)은 원거리 레인 기즈모에만(시각화, 판정 아님).

## 배경 (현재 구조)

적 공격 판정은 `Core/CombatPrimitives.mlua`(@Logic)의 커스텀 텔레그래프 시스템에 통합돼 있다:

- `RegisterEnemyAttack(center, radius, dmg, parryable, hitDelay, src)` — 공격 레코드 등록 + 클라 기즈모 브로드캐스트.
- 명중 판정/패링/슬로우트리거 모두 **`CircleOverlap`**(원-원) 사용:
  - 명중: `EnemyMelee`/`BossController`가 windup 종료 후 `CircleOverlap(rec.center, rec.radius, playerCenter, 0.5)`.
  - 패링: `TryParry`가 플레이어 공격 원과 적 공격 레코드 원 오버랩.
  - 슬로우 트리거: `AnyThreatNear`가 위협 원과 적 공격 레코드 원 오버랩.
- 기즈모: `NotifyEnemyAttack(id, center, radius, ...)` → 클라 `clientEnemyAttacks` 리스트 → `CombatGizmo`가 원으로 표시.

원거리는 별도: `EnemyRanged`(aim 1s → 단발 발사), 보스 `tripleShot`(windup 0.6s → `playerCenter + i*0.6` 방향 3발, i=-1,0,1). 투사체는 `script.Projectile` 엔티티로 비행하며 자체 충돌.

**접근 결정:** 네이티브 `AttackComponent`로 갈아타지 않는다 — 현재 텔레그래프/패링/그로기/슬로우/기즈모 통합이 모두 깨진다. **판정 "형태"만** 원→박스로 확장하고 파이프라인은 유지한다.

---

## Part A — 공격 판정 원 → 박스 (게임플레이; 적 + 플레이어)

### A1. 공격 레코드에 shape 추가
공격 레코드에 `shape` 필드 추가:
- 원: `shape="circle"`, `center`, `radius`.
- 박스: `shape="box"`, `center`(박스 중심), `hw`, `hh` (반폭/반높이). 적이 좌/우만 바라보므로 **AABB**(회전 없음).

두 가지 박스 배치(호출부가 `center`/`hw`/`hh`를 직접 계산해 넘김 — 프리미티브는 AABB만 저장):
- **전방 박스**(평타·보스 slam): 적 월드중심 `c`, 바라보는 방향 `facingX`(±1), forward `F`, height `H` → `center=(c.x + facingX*F/2, c.y)`, `hw=F/2`, `hh=H/2`. 적 앞면에서 정면으로 `F`만큼 뻗는 직사각형.
- **중앙 박스**(보스 redSmash, "주변 사각형"): 보스 중심 기준 축정렬 사각 → `center=c`, `hw=halfW`, `hh=halfH`. **가로로 넓고 세로로 낮게** — 좌우로는 못 빠져나가고(넓음), **위로(점프/대시)만** 피하게. 방향 무관.

#### 세로 회피 원칙 (게임필 — 모든 적 공격 박스에 적용)
박스 윗변(`center.y + hh`)을 **플레이어 점프 정점 / 위-대시 도달 높이보다 낮게** 잡는다. 박스 판정은 AABB-원이라 플레이어가 박스 위로 올라가면 자동으로 overlap=false → **빗나감**. 즉:
- redSmash: 넓은 `halfW`로 수평 도주를 막고, 낮은 `halfH`로 점프/위-대시 회피를 강제(주 회피 경로 = 위).
- 평타/slam 전방 박스의 `height(H)`도 점프/위-대시로 윗변을 넘을 수 있는 값으로 튜닝.
- 실제 점프 정점·위-대시 도달은 플레이테스트로 확인 후 박스 높이 상수 조정(체감).

### A2. 충돌 프리미티브 (CombatPrimitives 신규)
- `BoxCircleOverlap(boxCenter, hw, hh, circleCenter, r) → boolean`: AABB-원. 원 중심을 박스 [cx±hw, cy±hh]에 클램프한 최근접점과 원 중심 거리 ≤ r. (적 박스↔플레이어 원 / 플레이어 박스↔적·투사체 원 공용)
- `BoxBoxOverlap(aCenter, aHw, aHh, bCenter, bHw, bHh) → boolean`: AABB-AABB. `|ax-bx| ≤ aHw+bHw && |ay-by| ≤ aHh+bHh`. (플레이어 공격 박스 ↔ 적 공격 박스 = 패링)
- `RecordOverlapsCircle(rec, circleCenter, r) → boolean`: 디스패처. `rec.shape=="box"` → `BoxCircleOverlap(rec.center, rec.hw, rec.hh, circleCenter, r)`; 아니면 `CircleOverlap`. (적 공격이 플레이어 원을 맞히는 명중 판정 + 슬로우트리거)
- **적 명중·슬로우트리거를 `RecordOverlapsCircle`로 교체.** 투사체 루프(엔티티)는 `CircleOverlap` 그대로.

### A3. 박스 등록 진입점
`RegisterEnemyAttackBox(boxCenter, hw, hh, dmg, parryable, hitDelay, src) → rec`:
- box 레코드(`shape="box"`, `center=boxCenter`, `hw`, `hh`) 생성 + `BroadcastEnemyAttack`(Part B2 확장 시그니처)로 통지.
- 호출부가 A1의 전방/중앙 기하로 `boxCenter`/`hw`/`hh`를 계산해 넘김(프리미티브는 AABB만 저장 — 방향 로직 호출부 소유).
- 기존 `RegisterEnemyAttack`(원)은 **호출부가 모두 박스로 바뀌어 미사용** → 제거. (`CircleOverlap`은 투사체·플레이어→적 경로에서 계속 사용하므로 유지.)

### A4. 호출부 변경
- `EnemyMelee`: windup 개시 시 `RegisterEnemyAttack(myCenter, AttackRadius, ...)` → `RegisterEnemyAttackBox(myCenter, facingX, EnemyMeleeBoxForward, EnemyMeleeBoxHeight, ...)`. 명중 판정 `CircleOverlap` → `RecordOverlapsCircle`. `facingX`는 추격 방향(플레이어 x 기준, 기존 `dir`/`FlipX` 로직과 동일)으로 산출.
- `BossController` `slam`: 전방 박스 `RegisterEnemyAttackBox(boxCenter=myCenter+facing*BossSlamBoxForward/2, hw=BossSlamBoxForward/2, hh=BossSlamBoxHeight/2, ...)`. 명중 판정 디스패처로. `bossEntityId` 주입 유지.
- `BossController` `redSmash`: **중앙 박스**(주변 사각형) `RegisterEnemyAttackBox(boxCenter=myCenter, hw=BossRedSmashBoxHalfW, hh=BossRedSmashBoxHalfH, parryable=false, ...)`. 가로 넓고 세로 낮음 → 위로만 회피. 명중 판정 디스패처로.

### A5. 트리거(공격 개시)
개시 조건은 거리 기반 유지(`dist <= AttackRadius`) — 박스는 **명중/빗나감만** 결정. 플레이어가 뒤/위로 피하면 빗나감(현 "evaded" 로직 강화). 빗나감 로그 유지.

### A6. 튜닝 상수 (GameConstants)
- `EnemyMeleeBoxForward`(기본 2.0), `EnemyMeleeBoxHeight`(1.5).
- `BossSlamBoxForward`(2.5), `BossSlamBoxHeight`(2.0).
- `BossRedSmashBoxHalfW`(3.5 — 넓게, 수평 도주 차단), `BossRedSmashBoxHalfH`(1.2 — 낮게, 점프/위-대시 회피). 기존 redSmash 원(radius 2.0) 대비 가로 넓힘·세로 낮춤.
- `PlayerAttackBoxForward`(기본 2.5 — 기존 원 r2.0 사거리 근사), `PlayerAttackBoxHeight`(2.0).
- 적별 프로퍼티(`EnemyMelee.AttackRadius` 등)는 트리거용으로 유지, 박스 치수는 상수(v1). 박스 높이는 점프/위-대시로 윗변 회피 가능하게 플레이테스트 튜닝.

### A7. 플레이어 평타 원 → 전방 수평 박스
현재 `PlayerCombat.RequestAttack`은 플레이어 중심 반지름 `RadiusAttack`(2.0) 원으로 `DamageEnemiesInCircle` + `TryParry`(둘 다 360°). 이를 **커서 좌/우 방향 전방 수평 박스**로:
- **facingX = 커서 기준**: `RequestAttack(dirX, dirY)`에 이미 커서 방향이 옴 → `facingX = (dirX >= 0) and 1 or -1` (커서가 플레이어보다 우=+1, 좌=-1). `dirX==0`(바로 위/아래) 경계는 `PlayerControllerComponent.LookDirectionX` 폴백.
- **박스**: `center=(pos.x + facingX*PlayerAttackBoxForward/2, pos.y + PlayerCenterYOffset)`, `hw=PlayerAttackBoxForward/2`, `hh=PlayerAttackBoxHeight/2`. (적 전방 박스와 동형, facingX만 커서 기반)
- **적 명중**: `DamageEnemiesInCircle` → 신규 `DamageEnemiesInBox(map, boxCenter, hw, hh, dmg, attackInfo)` — 적 열거 후 `BoxCircleOverlap(boxCenter, hw, hh, enemyPos, RadiusEnemyHitbox)`.
- **패링**: `TryParry`를 박스 받도록 일반화(또는 `TryParryBox(map, boxCenter, hw, hh, reflectDamage)`):
  - 적 공격 레코드(전부 박스) ↔ 플레이어 박스 = `BoxBoxOverlap`.
  - 적 투사체(원) ↔ 플레이어 박스 = `BoxCircleOverlap`.
- **이펙트**: 기존 커서 방향 회전 이펙트(`PlayAttackEffect`)는 유지(시각). 판정만 수평 박스.
- "앞뒤로 쓸 수 있도록": 커서를 플레이어 좌/우 어느 쪽에 두느냐로 박스 방향 전환 → 뒤 적은 커서를 뒤로 두고 침.

---

## Part B — 예상 공격 기즈모 (디버그 시각화)

retained-mode `GizmoManager`(직전 작업) 확장. 공격 형태별 정확한 마커.

| 공격 | 마커 | 색 | 표시 시점 | 데이터 경로 |
|---|---|---|---|---|
| 근접 평타 / 보스 slam | AABB 박스(전방) | 노랑 | windup | 브로드캐스트 레코드 |
| 보스 redSmash | AABB 박스(중앙, 넓고 낮음) | 빨강 | windup | 브로드캐스트 레코드 |
| 원거리 단발(EnemyRanged) | 회전 직사각형 1갈래 | 노랑 | aim | 클라 계산(synced flag) |
| 보스 tripleShot | 회전 직사각형 3갈래(±0.6) | 노랑 | windup | 클라 계산(synced flag) |
| 투사체(발사 후) | 원(주황) | — | 비행 | 기존 클라 열거 |
| **플레이어 평타** | AABB 박스(커서 좌/우 전방) | 하늘 | 공격 직후 플래시 | 클라(PlayerCombat lastAttack) |

> 적 공격 레코드 마커는 **전부 박스**(노랑 전방 / 빨강 중앙). 플레이어 평타도 **하늘색 박스**. 원 마커는 투사체(주황)·대시(사거리/마커)만 사용.

### B1. 두 데이터 경로
1. **브로드캐스트 레코드**(근접/slam/redSmash): 일회성, windup에 고정.
2. **클라 계산 레인**(원거리/tripleShot): 라이브. 적·플레이어 위치를 클라가 알고, 방향은 매 프레임 계산(플레이어 추적 = 텔레그래프). 적에 동기화 플래그만 추가.

### B2. 브로드캐스트 확장 (CombatPrimitives)
`NotifyEnemyAttack`/`BroadcastEnemyAttack` 시그니처에 박스 치수(`hw`,`hh`) 추가. `clientEnemyAttacks` 항목에 `hw`,`hh` 보관(현 레코드는 전부 박스).
- `CombatGizmo`의 적 공격 렌더 루프: `_GizmoManager:EnemyAttackBox(center, hw, hh, isRed)`. 색 판정(노랑=parryable·텔레그래프 / 빨강=명중임박·무패링) 로직 유지.

### B3. 클라 계산 레인 (synced flag)
- `EnemyRanged`: `@Sync property boolean IsAiming`. aim 단계 진입 시 true, 그 외 false(쿨다운/감지이탈/기절/은신).
- `BossController`: `@Sync property boolean TelegraphTriple`. tripleShot windup 동안 true, 그 외 false.
- `CombatGizmo`(클라, 매 프레임):
  - 맵의 `script.EnemyRanged` 열거 → `IsAiming==true`면 `dir = normalize(playerCenter - enemyCenter)`, `_GizmoManager:AttackLane(enemyCenter, dir, GizmoRangedLaneLength, GizmoRangedLaneWidth, false)` (1갈래).
  - 보스(`script.BossController`) `TelegraphTriple==true`면 i=-1,0,1에 대해 `target=(playerCenter.x, playerCenter.y + i*BossTripleSpread)`, `dir=normalize(target-bossCenter)`, `AttackLane(bossCenter, dir, ...)` (3갈래).

### B4. GizmoManager 확장
- 회전 직사각형은 기존 OBB 박스 홀더(`DashBlock`과 동일: 단위정사각 + WorldZRotation + Scale)와 동형. 
- **마커 풀 재구성**: 현 atkY/atkR(단위원, 인덱스 15~26)을 **박스 홀더**로 전환. 적 공격 박스(노랑 N + 빨강 M) + **레인용 노랑 박스 홀더 K** + **플레이어 평타용 하늘색 박스 홀더 1**(IdxFlash 원 → 박스). 박스/레인 모두 단위정사각 홀더(rot+scale)라 동형. 새 인덱스 레이아웃·풀 크기는 구현 시 확정, `GizmoLinePoolSize` 갱신.
- 신규 메서드:
  - `EnemyAttackBox(center, hw, hh, isRed)`: pos=center, rot=0, Scale=(2hw, 2hh). (AABB — 노랑/빨강 박스 풀 커서)
  - `AttackLane(origin, dir, length, width)`: pos=origin + dir*(length/2), `WorldZRotation=math.deg(math.atan(dir.y, dir.x))`, Scale=(length, width). (OBB 레인 — 원점에서 dir로 뻗음, 노랑 레인 풀 커서)
  - `AttackFlash(center, hw, hh)`: 하늘색 박스 슬롯(기존 원 시그니처 `AttackFlash(center)` → 박스로 변경). pos=center, Scale=(2hw,2hh).
- 적공격 원 홀더(atkY/atkR 원) 제거. `CombatGizmo`는 플레이어 평타 박스를 그리려면 그 공격의 facingX가 필요 → `PlayerCombat`에 `lastAttackFacingX`(클라) 노출, 가시 시간(`GizmoAttackFlash`) 내 박스로 표시.

### B5. 상수 (GameConstants)
- `GizmoRangedLaneLength`(기본 6.0 — 투사체 사거리 근사, 실측 후 조정), `GizmoRangedLaneWidth`(0.4 ≈ 투사체 굵기×2).
- `BossTripleSpread`(0.6 — `BossController` ResolvePattern의 `i*0.6`와 동일 값. 상수로 추출해 공유).

---

## 영향 파일

- `Core/CombatPrimitives.mlua` — `BoxCircleOverlap`/`BoxBoxOverlap`/`RecordOverlapsCircle`/`RegisterEnemyAttackBox`/`DamageEnemiesInBox` 추가, `AnyThreatNear` 디스패처화, `TryParry` 박스화, 브로드캐스트 시그니처 확장, `RegisterEnemyAttack`(원) 제거.
- `Player/PlayerCombat.mlua` — 평타 원 → 커서 좌/우 전방 박스(`DamageEnemiesInBox`+`TryParry` 박스), `lastAttackFacingX` 노출.
- `Enemy/EnemyMelee.mlua` — 박스 등록 + facingX + 명중 디스패처.
- `Enemy/EnemyRanged.mlua` — `@Sync IsAiming`.
- `Enemy/Boss/BossController.mlua` — slam 박스 등록 + 명중 디스패처, `@Sync TelegraphTriple`, `BossTripleSpread` 상수화.
- `Player/CombatGizmo.mlua` — 박스/원 레코드 렌더 분기 + 원거리/triple 레인 클라 계산.
- `Player/GizmoManager.mlua` — `EnemyAttackBox`/`AttackLane` + 풀 재구성.
- `Core/GameConstants.mlua` — 박스/레인/스프레드 상수 + 풀 크기.

## 검증 (Maker play map02 + map03 보스)

- 빌드 0에러.
- 근접: 적 정면에서 맞고(박스 명중), 적 뒤/위로 피하면 빗나감(execute_script로 박스 오버랩 케이스 + 실측). 패링이 박스 공격에도 동작.
- 플레이어 평타: 커서 우=오른쪽 적 명중·왼쪽 적 빗나감, 커서 좌=반대(앞뒤 전환). 패링(box-box)으로 노랑 적 공격 무효화·투사체 반사 동작.
- **보스 redSmash 세로 회피**: 박스 안에서 가만히=피격, **점프 또는 위-대시로 박스 윗변 위로 올라가면 회피**(playerCenter.y > center.y+hh → overlap=false). 좌우로는 박스가 넓어 못 빠져나감. 박스 높이/폭이 점프·대시 도달과 맞물리는지 실측 후 상수 튜닝.
- 기즈모: 근접 windup 시 노랑 박스가 적 전방에, 보스 slam 노랑 박스/redSmash 빨강 중앙 박스, 원거리 aim 시 노랑 레인 1갈래(플레이어 추적), 보스 tripleShot 3갈래가 실제 발사 방향과 일치(스크린샷).
- 런타임 에러(LEA-/Exception/nil) 0.

## 비목표 / Out of scope

- 네이티브 `AttackComponent` 전환(안 함).
- 회전 근접 박스(적이 좌/우만 보므로 AABB로 충분 — 대각 공격 없음).
- 원거리 판정 자체 변경(투사체 충돌은 그대로, 기즈모 시각화만).
- 박스 치수 적별 프로퍼티(v1은 상수, 필요 시 후속).
