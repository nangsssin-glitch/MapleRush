# 적 공격 박스 판정 + 예상 공격 기즈모 — 설계

- 날짜: 2026-06-28
- 작성: dust9826 (+ Claude)
- 관련 티켓: MR-G (적 AI 상태패턴 정비 — 공격 모션/판정 분리)와 인접. 본 작업은 "공격 판정 형태" 변경 + 디버그 시각화.

## 목표

적 근접 공격의 명중 판정을 **자기 중심 원**에서 **전방 방향성 사각형(box)**으로 바꾼다(적이 바라보는 방향 앞으로 뻗는 직사각형). 더불어 모든 적 공격의 **예상 공격 위치를 디버그 기즈모로 정확히** 표시한다 — 근접=박스, 광역=원, 원거리=회전 직사각형 레인(멀티샷이면 여러 갈래).

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

## Part A — 근접 판정 원 → 박스 (게임플레이)

### A1. 공격 레코드에 shape 추가
`RegisterEnemyAttack`가 만드는 레코드에 `shape` 필드 추가:
- 기존 원: `shape="circle"`, `center`, `radius` (그대로).
- 신규 박스: `shape="box"`, `center`(박스 중심), `hw`, `hh` (반폭/반높이). 적이 좌/우만 바라보므로 **AABB**(회전 없음).

박스 기하: 적 월드중심 `c`, 바라보는 방향 `facingX`(±1), forward `F`, height `H`:
- `center = (c.x + facingX*F/2, c.y)`, `hw = F/2`, `hh = H/2`.
- 즉 적 앞면(중심)에서 정면으로 `F`만큼 뻗고 세로 `H`인 직사각형.

### A2. 충돌 프리미티브 (CombatPrimitives 신규)
- `BoxCircleOverlap(boxCenter, hw, hh, circleCenter, r) → boolean`: 표준 AABB-원. 원 중심을 박스 [cx±hw, cy±hh]에 클램프한 최근접점과 원 중심 거리 ≤ r.
- `RecordOverlapsCircle(rec, circleCenter, r) → boolean`: 디스패처. `rec.shape=="box"` → `BoxCircleOverlap(rec.center, rec.hw, rec.hh, circleCenter, r)`; 아니면 `CircleOverlap(rec.center, rec.radius, circleCenter, r)`.
- **명중·패링·슬로우트리거 3곳을 전부 `RecordOverlapsCircle`로 교체** → 박스/원 레코드 공존. (`AnyThreatNear`/`TryParry`의 레코드 루프, `EnemyMelee`/`BossController`의 명중 판정.)
  - 단, `TryParry`/`AnyThreatNear`의 **투사체 루프**(레코드 아님, 엔티티)는 `CircleOverlap` 그대로.
  - 플레이어→적 공격(적 히트박스 원)도 그대로 `CircleOverlap`.

### A3. 박스 등록 진입점
`RegisterEnemyAttackBox(center, facingX, forward, height, dmg, parryable, hitDelay, src) → rec`:
- A1 기하로 box 레코드 생성 + `BroadcastEnemyAttack`(Part B2의 확장 시그니처)로 통지.
- 기존 `RegisterEnemyAttack`(원)은 redSmash 등 광역용으로 유지.

### A4. 호출부 변경
- `EnemyMelee`: windup 개시 시 `RegisterEnemyAttack(myCenter, AttackRadius, ...)` → `RegisterEnemyAttackBox(myCenter, facingX, EnemyMeleeBoxForward, EnemyMeleeBoxHeight, ...)`. 명중 판정 `CircleOverlap` → `RecordOverlapsCircle`. `facingX`는 추격 방향(플레이어 x 기준, 기존 `dir`/`FlipX` 로직과 동일)으로 산출.
- `BossController` `slam`: 동일하게 `RegisterEnemyAttackBox(..., BossSlamBoxForward, BossSlamBoxHeight, ...)`. 명중 판정 디스패처로. `bossEntityId` 주입 유지.
- `redSmash`: 변경 없음(원 광역, 의도적 전방위).

### A5. 트리거(공격 개시)
개시 조건은 거리 기반 유지(`dist <= AttackRadius`) — 박스는 **명중/빗나감만** 결정. 플레이어가 뒤/위로 피하면 빗나감(현 "evaded" 로직 강화). 빗나감 로그 유지.

### A6. 튜닝 상수 (GameConstants)
- `EnemyMeleeBoxForward`(기본 2.0), `EnemyMeleeBoxHeight`(1.5).
- `BossSlamBoxForward`(2.5), `BossSlamBoxHeight`(2.5).
- 적별 프로퍼티(`EnemyMelee.AttackRadius` 등)는 트리거용으로 유지, 박스 치수는 상수(필요 시 적별 프로퍼티 추가 가능, v1은 상수).

---

## Part B — 예상 공격 기즈모 (디버그 시각화)

retained-mode `GizmoManager`(직전 작업) 확장. 공격 형태별 정확한 마커.

| 공격 | 마커 | 색 | 표시 시점 | 데이터 경로 |
|---|---|---|---|---|
| 근접 평타 / 보스 slam | AABB 박스(전방) | 노랑 | windup | 브로드캐스트 레코드 |
| 보스 redSmash | 원(광역) | 빨강 | windup | 브로드캐스트 레코드 |
| 원거리 단발(EnemyRanged) | 회전 직사각형 1갈래 | 노랑 | aim | 클라 계산(synced flag) |
| 보스 tripleShot | 회전 직사각형 3갈래(±0.6) | 노랑 | windup | 클라 계산(synced flag) |
| 투사체(발사 후) | 원(주황) | — | 비행 | 기존 클라 열거 |

### B1. 두 데이터 경로
1. **브로드캐스트 레코드**(근접/slam/redSmash): 일회성, windup에 고정.
2. **클라 계산 레인**(원거리/tripleShot): 라이브. 적·플레이어 위치를 클라가 알고, 방향은 매 프레임 계산(플레이어 추적 = 텔레그래프). 적에 동기화 플래그만 추가.

### B2. 브로드캐스트 확장 (CombatPrimitives)
`NotifyEnemyAttack`/`BroadcastEnemyAttack` 시그니처에 `shape`(string) + 박스 치수(`hw`,`hh`) 추가. `clientEnemyAttacks` 항목에 `shape`,`hw`,`hh` 보관. circle 항목은 기존 `radius` 유지.
- `CombatGizmo`의 적 공격 렌더 루프: `shape=="box"` → `_GizmoManager:EnemyAttackBox(center, hw, hh, isRed)`; 아니면 기존 원 `EnemyAttack(center, radius, isRed)`. 색 판정(노랑/빨강) 로직 유지.

### B3. 클라 계산 레인 (synced flag)
- `EnemyRanged`: `@Sync property boolean IsAiming`. aim 단계 진입 시 true, 그 외 false(쿨다운/감지이탈/기절/은신).
- `BossController`: `@Sync property boolean TelegraphTriple`. tripleShot windup 동안 true, 그 외 false.
- `CombatGizmo`(클라, 매 프레임):
  - 맵의 `script.EnemyRanged` 열거 → `IsAiming==true`면 `dir = normalize(playerCenter - enemyCenter)`, `_GizmoManager:AttackLane(enemyCenter, dir, GizmoRangedLaneLength, GizmoRangedLaneWidth, false)` (1갈래).
  - 보스(`script.BossController`) `TelegraphTriple==true`면 i=-1,0,1에 대해 `target=(playerCenter.x, playerCenter.y + i*BossTripleSpread)`, `dir=normalize(target-bossCenter)`, `AttackLane(bossCenter, dir, ...)` (3갈래).

### B4. GizmoManager 확장
- 회전 직사각형은 기존 OBB 박스 홀더(`DashBlock`과 동일: 단위정사각 + WorldZRotation + Scale)와 동형. 
- **적 공격 마커 풀 재구성**: 현 atkY/atkR(단위원, 인덱스 15~26)을 **박스 홀더**로 전환(근접 박스용) + **레인용 노랑 박스 홀더** 추가. 새 인덱스 레이아웃과 풀 크기는 구현 시 확정(예: 노랑 박스 N + 빨강 박스 M + 레인 노랑 K). `GizmoLinePoolSize` 갱신.
- 신규 메서드:
  - `EnemyAttackBox(center, hw, hh, isRed)`: pos=center, rot=0, Scale=(2hw, 2hh). (AABB)
  - `AttackLane(origin, dir, length, width, isRed)`: pos=origin + dir*(length/2), `WorldZRotation=math.deg(math.atan(dir.y, dir.x))`, Scale=(length, width). (OBB 레인 — 원점에서 dir로 뻗음)
- redSmash 원은 기존 적공격 원 경로(빨강 원 홀더 1~2개 별도 유지) 또는 atkR 원 일부 유지 — 구현 시 정리.

### B5. 상수 (GameConstants)
- `GizmoRangedLaneLength`(기본 6.0 — 투사체 사거리 근사, 실측 후 조정), `GizmoRangedLaneWidth`(0.4 ≈ 투사체 굵기×2).
- `BossTripleSpread`(0.6 — `BossController` ResolvePattern의 `i*0.6`와 동일 값. 상수로 추출해 공유).

---

## 영향 파일

- `Core/CombatPrimitives.mlua` — `BoxCircleOverlap`/`RecordOverlapsCircle`/`RegisterEnemyAttackBox` 추가, `AnyThreatNear`/`TryParry` 디스패처화, 브로드캐스트 시그니처 확장.
- `Enemy/EnemyMelee.mlua` — 박스 등록 + facingX + 명중 디스패처.
- `Enemy/EnemyRanged.mlua` — `@Sync IsAiming`.
- `Enemy/Boss/BossController.mlua` — slam 박스 등록 + 명중 디스패처, `@Sync TelegraphTriple`, `BossTripleSpread` 상수화.
- `Player/CombatGizmo.mlua` — 박스/원 레코드 렌더 분기 + 원거리/triple 레인 클라 계산.
- `Player/GizmoManager.mlua` — `EnemyAttackBox`/`AttackLane` + 풀 재구성.
- `Core/GameConstants.mlua` — 박스/레인/스프레드 상수 + 풀 크기.

## 검증 (Maker play map02 + map03 보스)

- 빌드 0에러.
- 근접: 적 정면에서 맞고(박스 명중), 적 뒤/위로 피하면 빗나감(execute_script로 박스 오버랩 케이스 + 실측). 패링이 박스 공격에도 동작.
- 기즈모: 근접 windup 시 노랑 박스가 적 전방에, 보스 slam 박스/redSmash 원, 원거리 aim 시 노랑 레인 1갈래(플레이어 추적), 보스 tripleShot 3갈래가 실제 발사 방향과 일치(스크린샷).
- 런타임 에러(LEA-/Exception/nil) 0.

## 비목표 / Out of scope

- 네이티브 `AttackComponent` 전환(안 함).
- 회전 근접 박스(적이 좌/우만 보므로 AABB로 충분 — 대각 공격 없음).
- 원거리 판정 자체 변경(투사체 충돌은 그대로, 기즈모 시각화만).
- 박스 치수 적별 프로퍼티(v1은 상수, 필요 시 후속).
