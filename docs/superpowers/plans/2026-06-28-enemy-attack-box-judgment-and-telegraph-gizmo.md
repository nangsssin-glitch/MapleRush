# 적·플레이어 공격 박스 판정 + 예상 공격 기즈모 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 적·플레이어 공격 판정을 원→AABB 박스로 바꾸고(근접=전방, 보스 광역=중앙, 플레이어=커서 좌/우 전방), 모든 공격의 예상 위치를 디버그 기즈모(박스/회전 레인)로 표시한다.

**Architecture:** 커스텀 텔레그래프 시스템(`CombatPrimitives` @Logic)을 유지하고 판정 "형태"만 확장. 공격 레코드에 `shape="box"` + `hw/hh` 추가, AABB overlap 프리미티브 2종(`BoxCircleOverlap`/`BoxBoxOverlap)으로 명중·패링·슬로우트리거 처리. 기즈모는 직전 작업의 retained-mode `GizmoManager`에 박스/레인 홀더 추가.

**Tech Stack:** MSW mlua (.mlua), Maker MCP(play/logs/execute_script/screenshot). **단위테스트 프레임워크 없음** — "test"는 (1) 저장 시 자동 실행되는 LSP `mlua-diagnose`(에러 0), (2) play 중 `execute_script`로 기하/판정 단위검증(log 단언), (3) play+screenshot 시각검증으로 대체한다.

## Global Constraints

- 좌표 = 월드유닛(1유닛=100px). 모든 박스 치수/오프셋은 유닛.
- 모든 공격 박스는 **AABB**(회전 없음). 회전은 원거리 레인 기즈모(시각화)에만.
- 적 공격 판정/패링/그로기/슬로우/브로드캐스트 파이프라인은 **유지** — 네이티브 AttackComponent로 전환 금지.
- `@ExecSpace("Client")` RPC 파라미터는 `Vector2/number/boolean`만 사용(현 제약 준수). `NotifyEnemyAttack`의 `targetUserId`는 암묵 인자 — 선언 금지.
- `.mlua` 수정 후 `mlua-diagnose` 에러 0 확인 → Maker `refresh` → play 검증.
- 플레이어=원(반지름 `RadiusEnemyHitbox`/0.5 동등), 적 히트박스=원(`RadiusEnemyHitbox` 0.5), 투사체=원(`RadiusProjectile` 0.2).
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 커밋 본문/명령에 `.model`/`.ui` 리터럴 금지(빌더 가드).

---

## File Structure

- `RootDesk/MyDesk/Core/GameConstants.mlua` — 박스/레인/스프레드 튜닝 상수 + 기즈모 풀 크기.
- `RootDesk/MyDesk/Core/CombatPrimitives.mlua` — overlap 프리미티브, 박스 레코드 등록, 박스 명중/패링, 브로드캐스트 확장.
- `RootDesk/MyDesk/Enemy/EnemyMelee.mlua` — 전방 박스 등록 + 명중 디스패처.
- `RootDesk/MyDesk/Enemy/Boss/BossController.mlua` — slam 전방/redSmash 중앙 박스 + 명중 디스패처 + `@Sync TelegraphTriple`.
- `RootDesk/MyDesk/Enemy/EnemyRanged.mlua` — `@Sync IsAiming`.
- `RootDesk/MyDesk/Player/PlayerCombat.mlua` — 커서 좌/우 전방 박스 + `lastAttackFacingX`.
- `RootDesk/MyDesk/Player/GizmoManager.mlua` — 박스/레인/플래시박스 홀더 + 메서드.
- `RootDesk/MyDesk/Player/CombatGizmo.mlua` — 박스/레인 렌더.

---

## Task 1: GameConstants — 신규 상수

**Files:**
- Modify: `RootDesk/MyDesk/Core/GameConstants.mlua`

**Interfaces:**
- Produces: `_GameConstants.EnemyMeleeBoxForward/EnemyMeleeBoxHeight/BossSlamBoxForward/BossSlamBoxHeight/BossRedSmashBoxHalfW/BossRedSmashBoxHalfH/PlayerAttackBoxForward/PlayerAttackBoxHeight/BossTripleSpread/GizmoRangedLaneLength/GizmoRangedLaneWidth` (모두 number).

- [ ] **Step 1: 박스 판정 상수 추가**

`GameConstants.mlua`의 범위 반지름 블록(`RadiusProjectile = 0.2` 다음 줄) 뒤에 추가:

```lua
	-- ========== 공격 박스 판정 (원→AABB 박스, world unit) ==========
	-- 적 근접 평타: 적 정면으로 뻗는 전방 박스 (forward=사거리, height=세로). 높이는 점프/위-대시로 윗변 회피 가능하게.
	property number EnemyMeleeBoxForward = 2.0
	property number EnemyMeleeBoxHeight = 1.5
	-- 보스 slam: 전방 박스 (적보다 큼).
	property number BossSlamBoxForward = 2.5
	property number BossSlamBoxHeight = 2.0
	-- 보스 redSmash: 중앙 박스 (가로 넓고 세로 낮음 → 좌우 도주 차단, 점프/위-대시로만 회피). half = 반폭/반높이.
	property number BossRedSmashBoxHalfW = 3.5
	property number BossRedSmashBoxHalfH = 1.2
	-- 플레이어 평타: 커서 좌/우 방향 전방 수평 박스.
	property number PlayerAttackBoxForward = 2.5
	property number PlayerAttackBoxHeight = 2.0
	-- 보스 tripleShot 세로 스프레드(레인/발사 공용 — ResolvePattern의 i*0.6와 동일 값).
	property number BossTripleSpread = 0.6
	-- 원거리 예상 공격 레인 기즈모: 길이(투사체 가시 사거리 근사) + 폭(투사체 굵기×2).
	property number GizmoRangedLaneLength = 6.0
	property number GizmoRangedLaneWidth = 0.4
```

- [ ] **Step 2: diagnose 확인**

저장 → `mlua-diagnose` 자동 실행. Expected: errors=0.

- [ ] **Step 3: refresh + 빌드 로그**

Maker MCP `refresh` → `logs(kind="build")`. Expected: count=0.

- [ ] **Step 4: 커밋**

```bash
git add RootDesk/MyDesk/Core/GameConstants.mlua
git commit -m "feat(combat): 공격 박스 판정 + 레인 기즈모 튜닝 상수 추가"
```

---

## Task 2: CombatPrimitives — AABB overlap 프리미티브

**Files:**
- Modify: `RootDesk/MyDesk/Core/CombatPrimitives.mlua` (`CircleOverlap` 메서드 바로 뒤, line ~136)

**Interfaces:**
- Consumes: 없음.
- Produces: `method boolean BoxCircleOverlap(Vector2 boxCenter, number hw, number hh, Vector2 circleCenter, number r)`, `method boolean BoxBoxOverlap(Vector2 aCenter, number aHw, number aHh, Vector2 bCenter, number bHw, number bHh)`.

- [ ] **Step 1: 두 프리미티브 추가**

`CircleOverlap` 메서드 `end` 다음에 삽입:

```lua
	method boolean BoxCircleOverlap(Vector2 boxCenter, number hw, number hh, Vector2 circleCenter, number r)
		-- AABB(중심 boxCenter, 반폭 hw, 반높이 hh) vs 원(circleCenter, r). 원 중심을 박스에 클램프한 최근접점 거리 ≤ r.
		local nx = circleCenter.x
		local minx = boxCenter.x - hw
		local maxx = boxCenter.x + hw
		if nx < minx then nx = minx elseif nx > maxx then nx = maxx end
		local ny = circleCenter.y
		local miny = boxCenter.y - hh
		local maxy = boxCenter.y + hh
		if ny < miny then ny = miny elseif ny > maxy then ny = maxy end
		local dx = circleCenter.x - nx
		local dy = circleCenter.y - ny
		return dx * dx + dy * dy <= r * r
	end

	method boolean BoxBoxOverlap(Vector2 aCenter, number aHw, number aHh, Vector2 bCenter, number bHw, number bHh)
		-- AABB-AABB. 두 박스 중심 거리가 각 축 반폭/반높이 합 이내면 겹침.
		return math.abs(aCenter.x - bCenter.x) <= (aHw + bHw) and math.abs(aCenter.y - bCenter.y) <= (aHh + bHh)
	end
```

- [ ] **Step 2: diagnose 확인**

Expected: errors=0.

- [ ] **Step 3: refresh + play + 기하 단위검증(execute_script)**

`refresh` → `play` → `execute_script(context="client")`:

```lua
local cp = _CombatPrimitives
local bc = Vector2(0, 0)
-- BoxCircleOverlap: 박스 hw=1,hh=0.5
local t1 = cp:BoxCircleOverlap(bc, 1.0, 0.5, Vector2(0.5, 0.0), 0.5)   -- 안쪽 → true
local t2 = cp:BoxCircleOverlap(bc, 1.0, 0.5, Vector2(1.4, 0.0), 0.5)   -- 우측 경계서 0.4 → 1.4-1.0=0.4 ≤ 0.5 true
local t3 = cp:BoxCircleOverlap(bc, 1.0, 0.5, Vector2(0.0, 1.2), 0.5)   -- 위로 1.2-0.5=0.7 > 0.5 false
-- BoxBoxOverlap
local b1 = cp:BoxBoxOverlap(Vector2(0,0), 1.0, 0.5, Vector2(1.5, 0.0), 0.6, 0.5)  -- |1.5|≤1.6 && |0|≤1.0 true
local b2 = cp:BoxBoxOverlap(Vector2(0,0), 1.0, 0.5, Vector2(0.0, 1.2), 0.6, 0.5)  -- |1.2|>1.0 false
log("[T2] bc t1=" .. tostring(t1) .. " t2=" .. tostring(t2) .. " t3=" .. tostring(t3) .. " bb b1=" .. tostring(b1) .. " b2=" .. tostring(b2))
```

`logs(kind="normal")`. Expected: `t1=true t2=true t3=false b1=true b2=false`.

- [ ] **Step 4: stop + 커밋**

```bash
git add RootDesk/MyDesk/Core/CombatPrimitives.mlua
git commit -m "feat(combat): AABB BoxCircleOverlap + BoxBoxOverlap 프리미티브"
```

---

## Task 3: CombatPrimitives — 박스 공격 레코드 + 브로드캐스트

**Files:**
- Modify: `RootDesk/MyDesk/Core/CombatPrimitives.mlua` (`RegisterEnemyAttack` 교체, `AnyThreatNear` 디스패처화, `BroadcastEnemyAttack`/`NotifyEnemyAttack` 시그니처 확장, `RecordOverlapsCircle` 추가)

**Interfaces:**
- Consumes: `BoxCircleOverlap` (Task 2).
- Produces: `method table RegisterEnemyAttackBox(Vector2 boxCenter, number hw, number hh, number damage, boolean parryable, number hitDelay, Entity sourceEntity)` (레코드 `{id, shape="box", center, hw, hh, radius=0, damage, parryable, hitAt, expireAt, canceled, bossEntityId}`), `method boolean RecordOverlapsCircle(table rec, Vector2 circleCenter, number r)`. 변경 시그니처: `BroadcastEnemyAttack(sourceEntity, id, center, hw, hh, windup, life, parryable)`, `NotifyEnemyAttack(id, center, hw, hh, windup, life, parryable)`. clientEnemyAttacks 항목: `{id, center, hw, hh, parryable, windup, life, recvAt}`.

- [ ] **Step 1: `RegisterEnemyAttack`(원) → `RegisterEnemyAttackBox` 교체 + `RecordOverlapsCircle` 추가**

기존 `RegisterEnemyAttack` 메서드(`method table RegisterEnemyAttack(... radius ...)`) 전체를 아래로 교체:

```lua
	@ExecSpace("ServerOnly")
	method table RegisterEnemyAttackBox(Vector2 boxCenter, number hw, number hh, number damage, boolean parryable, number hitDelay, Entity sourceEntity)
		-- 적 공격 박스 레코드 등록(서버). hitDelay(텔레그래프) 후 명중 판정, 직후 만료. 반환: 레코드 테이블.
		-- boxCenter/hw/hh는 호출부가 전방/중앙 기하로 계산해 넘김(프리미티브는 AABB만 저장).
		if self.activeAttacks == nil then self.activeAttacks = {} end
		self.nextAttackId += 1
		local now = _UtilLogic.ServerElapsedSeconds
		local rec = {
			id = self.nextAttackId,
			shape = "box",
			center = boxCenter,
			hw = hw,
			hh = hh,
			radius = 0,
			damage = damage,
			parryable = parryable,
			hitAt = now + hitDelay,
			expireAt = now + hitDelay + 0.25,
			canceled = false,
			bossEntityId = nil,
		}
		table.insert(self.activeAttacks, rec)
		self:BroadcastEnemyAttack(sourceEntity, rec.id, boxCenter, hw, hh, hitDelay, hitDelay + 0.25, parryable)
		return rec
	end

	method boolean RecordOverlapsCircle(table rec, Vector2 circleCenter, number r)
		-- 공격 레코드 vs 원 디스패처. 현 레코드는 전부 box지만 안전하게 circle도 처리.
		if rec.shape == "box" then
			return self:BoxCircleOverlap(rec.center, rec.hw, rec.hh, circleCenter, r)
		end
		return self:CircleOverlap(rec.center, rec.radius, circleCenter, r)
	end
```

- [ ] **Step 2: `AnyThreatNear`의 레코드 루프를 디스패처로**

`AnyThreatNear` 내부 `if rec.canceled == false and self:CircleOverlap(center, radius, rec.center, rec.radius) then` 를:

```lua
				if rec.canceled == false and self:RecordOverlapsCircle(rec, center, radius) then
```

(투사체 루프의 `CircleOverlap`은 그대로 둔다.)

- [ ] **Step 3: 브로드캐스트 시그니처 확장 (radius → hw, hh)**

`BroadcastEnemyAttack` 시그니처/호출을 교체:

```lua
	@ExecSpace("ServerOnly")
	method void BroadcastEnemyAttack(Entity sourceEntity, number id, Vector2 center, number hw, number hh, number windup, number life, boolean parryable)
		-- 소스 적이 속한 맵의 모든 유저 클라에 공격 박스 통지(1인 1런 전제). DrawGizmo off면 미전송.
		if _GameConstants.DrawGizmo == false then return end
		if sourceEntity == nil or isvalid(sourceEntity) == false then return end
		local map = sourceEntity.CurrentMap
		if map == nil or isvalid(map) == false then return end
		local users = _UserService:GetUsersByMapComponent(map.MapComponent)
		if users == nil then return end
		for _, u in ipairs(users) do
			if isvalid(u) and u.PlayerComponent ~= nil then
				self:NotifyEnemyAttack(id, center, hw, hh, windup, life, parryable, u.PlayerComponent.UserId)
			end
		end
	end
```

`NotifyEnemyAttack` 시그니처/본문 교체(`radius` → `hw, hh`):

```lua
	@ExecSpace("Client")
	method void NotifyEnemyAttack(number id, Vector2 center, number hw, number hh, number windup, number life, boolean parryable)
		-- 클라 수신: 공격 박스 기즈모 등록(같은 id 있으면 교체). targetUserId는 암묵 인자(선언 금지).
		if self.clientEnemyAttacks == nil then self.clientEnemyAttacks = {} end
		for i = #self.clientEnemyAttacks, 1, -1 do
			if self.clientEnemyAttacks[i].id == id then table.remove(self.clientEnemyAttacks, i) end
		end
		table.insert(self.clientEnemyAttacks, {
			id = id,
			center = center,
			hw = hw,
			hh = hh,
			parryable = parryable,
			windup = windup,
			life = life,
			recvAt = _WallClock:Now(),
		})
	end
```

- [ ] **Step 4: diagnose 확인 (호출부 에러 노출)**

Expected: `EnemyMelee`/`BossController`의 `RegisterEnemyAttack` 호출이 "not found"로 뜸(Task 5/6에서 교체). CombatPrimitives 자체는 errors=0. 이 단계의 diagnose 에러는 호출부 미교체 분뿐인지 확인.

- [ ] **Step 5: 커밋**

```bash
git add RootDesk/MyDesk/Core/CombatPrimitives.mlua
git commit -m "feat(combat): 박스 공격 레코드(RegisterEnemyAttackBox) + 브로드캐스트 hw/hh 확장"
```

---

## Task 4: CombatPrimitives — 박스 명중/패링

**Files:**
- Modify: `RootDesk/MyDesk/Core/CombatPrimitives.mlua` (`DamageEnemiesInCircle` 뒤에 `DamageEnemiesInBox` 추가, `TryParry` 박스화)

**Interfaces:**
- Consumes: `BoxCircleOverlap`/`BoxBoxOverlap` (Task 2), `RecordOverlapsCircle` (Task 3).
- Produces: `method integer DamageEnemiesInBox(Entity mapEntity, Vector2 boxCenter, number hw, number hh, number damage, string source)`. 변경 시그니처: `method integer TryParry(Entity mapEntity, Vector2 boxCenter, number hw, number hh, number reflectDamage)`.

- [ ] **Step 1: `DamageEnemiesInBox` 추가**

`DamageEnemiesInCircle` 메서드 `end` 다음에 삽입:

```lua
	method integer DamageEnemiesInBox(Entity mapEntity, Vector2 boxCenter, number hw, number hh, number damage, string source)
		-- 박스 범위 내 모든 적(script.EnemyHealth)에 데미지. 명중 수 반환. 서버 메서드에서 호출할 것.
		if mapEntity == nil then return 0 end
		local list = mapEntity:GetChildComponentsByTypeName("script.EnemyHealth", true)
		local hitCount = 0
		for _, compAny in ipairs(list) do
			---@type EnemyHealth
			local comp = compAny
			local e = comp.Entity
			if isvalid(e) then
				local p = e.TransformComponent.WorldPosition
				if self:BoxCircleOverlap(boxCenter, hw, hh, Vector2(p.x, p.y), _GameConstants.RadiusEnemyHitbox) then
					comp:TakeDamage(damage, source)
					hitCount += 1
				end
			end
		end
		return hitCount
	end
```

- [ ] **Step 2: `TryParry`를 박스로**

`TryParry` 시그니처와 두 overlap 호출을 교체. 시그니처:

```lua
	@ExecSpace("ServerOnly")
	method integer TryParry(Entity mapEntity, Vector2 boxCenter, number hw, number hh, number reflectDamage)
```

레코드 루프 조건 `if rec.canceled == false and rec.parryable and self:CircleOverlap(attackCenter, attackRadius, rec.center, rec.radius) then` →

```lua
			if rec.canceled == false and rec.parryable and self:BoxBoxOverlap(boxCenter, hw, hh, rec.center, rec.hw, rec.hh) then
```

투사체 루프 조건 `if self:CircleOverlap(attackCenter, attackRadius, Vector2(p.x, p.y), _GameConstants.RadiusProjectile) then` →

```lua
				if self:BoxCircleOverlap(boxCenter, hw, hh, Vector2(p.x, p.y), _GameConstants.RadiusProjectile) then
```

(메서드 본문 내 `attackCenter`/`attackRadius` 참조가 더 없는지 확인 — 위 두 곳이 전부.)

- [ ] **Step 3: diagnose 확인**

Expected: CombatPrimitives errors=0. `PlayerCombat`의 `DamageEnemiesInCircle`/`TryParry(center, radius, ...)` 호출이 "argument" 불일치로 뜸(Task 7에서 교체).

- [ ] **Step 4: 커밋**

```bash
git add RootDesk/MyDesk/Core/CombatPrimitives.mlua
git commit -m "feat(combat): DamageEnemiesInBox + TryParry 박스화(box-box/box-circle)"
```

---

## Task 5: EnemyMelee — 전방 박스

**Files:**
- Modify: `RootDesk/MyDesk/Enemy/EnemyMelee.mlua` (`OnUpdate`의 windup 등록 + 명중 판정)

**Interfaces:**
- Consumes: `RegisterEnemyAttackBox`, `RecordOverlapsCircle` (Task 3).

- [ ] **Step 1: 공격 개시(등록)를 박스로**

`OnUpdate`의 windup 개시 블록에서 `self.pendingAttack = _CombatPrimitives:RegisterEnemyAttack(myCenter, self.AttackRadius, 1, self.AttackParryable, self.WindupTime, self.Entity)` 를 교체. `myCenter` 위(line 77 `myCenter = Vector2(myPos.x, myPos.y + 0.5)`)와 `dx`(line 78)는 이미 있음. facingX는 플레이어 x 기준:

```lua
					local facingX = 1
					if dx < 0 then facingX = -1 end
					local f = _GameConstants.EnemyMeleeBoxForward
					local boxCenter = Vector2(myCenter.x + facingX * f * 0.5, myCenter.y)
					self.pendingAttack = _CombatPrimitives:RegisterEnemyAttackBox(boxCenter, f * 0.5, _GameConstants.EnemyMeleeBoxHeight * 0.5, 1, self.AttackParryable, self.WindupTime, self.Entity)
```

(기존 `_CombatPrimitives:RegisterEnemyAttack(...)` 한 줄을 위 5줄로 대체.)

- [ ] **Step 2: 명중 판정을 디스패처로**

windup 종료 블록의 `if _CombatPrimitives:CircleOverlap(rec.center, rec.radius, playerCenter, 0.5) then` →

```lua
					if _CombatPrimitives:RecordOverlapsCircle(rec, playerCenter, 0.5) then
```

- [ ] **Step 3: diagnose 확인**

Expected: EnemyMelee errors=0.

- [ ] **Step 4: refresh + play + 실측(execute_script)**

`refresh` → `play` → (theme/node 진행: `_FloorManager:RequestSelectTheme("theme1")` wait `_FloorManager:RequestSelectNode(1)`; 잔류 팝업 닫기 — `_FloorManager.themeUI.themeRoot.Enable=false`, nodeRoot 엔티티 `33d78a40-f3df-41ea-9140-4d4a354d4aa0` Enable=false) → 근접적 근처로 이동 후 피격/회피 관찰.
- 단위검증: `execute_script`로 적 박스 레코드를 직접 만들고 플레이어 정면/위 위치에서 `RecordOverlapsCircle` 결과 확인.

```lua
local cp = _CombatPrimitives
local rec = { shape="box", center=Vector2(0,0), hw=1.0, hh=0.75, radius=0 }
log("[T5] front=" .. tostring(cp:RecordOverlapsCircle(rec, Vector2(0.8,0), 0.5)) .. " above=" .. tostring(cp:RecordOverlapsCircle(rec, Vector2(0, 1.6), 0.5)))
```

Expected: `front=true above=false`(위로 1.6은 hh0.75+r0.5=1.25 초과 → 빗나감). `logs`에 명중/`attack missed` 로그.

- [ ] **Step 5: stop + 커밋**

```bash
git add RootDesk/MyDesk/Enemy/EnemyMelee.mlua
git commit -m "feat(enemy): 근접 평타 판정 원→전방 박스"
```

---

## Task 6: BossController — slam 전방 / redSmash 중앙 박스

**Files:**
- Modify: `RootDesk/MyDesk/Enemy/Boss/BossController.mlua` (`StartPattern`의 slam/redSmash 등록, `ResolvePattern`의 명중 판정)

**Interfaces:**
- Consumes: `RegisterEnemyAttackBox`, `RecordOverlapsCircle` (Task 3).

- [ ] **Step 1: slam 등록을 전방 박스로**

`StartPattern`의 slam 분기 `self.pendingAttack = _CombatPrimitives:RegisterEnemyAttack(myCenter, 1.5, 1, true, 0.8, self.Entity)` 를 교체. facingX는 플레이어 방향(StartPattern 인자 `playerCenter`/`myCenter` 사용):

```lua
			local sFacing = 1
			if playerCenter.x < myCenter.x then sFacing = -1 end
			local sf = _GameConstants.BossSlamBoxForward
			self.pendingAttack = _CombatPrimitives:RegisterEnemyAttackBox(Vector2(myCenter.x + sFacing * sf * 0.5, myCenter.y), sf * 0.5, _GameConstants.BossSlamBoxHeight * 0.5, 1, true, 0.8, self.Entity)
			self.pendingAttack.bossEntityId = self.Entity.Name
```

(기존 slam 의 `RegisterEnemyAttack` 한 줄 + 바로 다음 `self.pendingAttack.bossEntityId = self.Entity.Name` 줄을 위 블록으로 대체.)

- [ ] **Step 2: redSmash 등록을 중앙 박스로**

redSmash 분기 `self.pendingAttack = _CombatPrimitives:RegisterEnemyAttack(myCenter, 2.0, 1, false, 1.0, self.Entity)` →

```lua
			self.pendingAttack = _CombatPrimitives:RegisterEnemyAttackBox(myCenter, _GameConstants.BossRedSmashBoxHalfW, _GameConstants.BossRedSmashBoxHalfH, 1, false, 1.0, self.Entity)
```

- [ ] **Step 3: 명중 판정을 디스패처로**

`ResolvePattern`의 slam/redSmash 분기 `if _CombatPrimitives:CircleOverlap(rec.center, rec.radius, playerCenter, 0.5) then` →

```lua
				if _CombatPrimitives:RecordOverlapsCircle(rec, playerCenter, 0.5) then
```

- [ ] **Step 4: diagnose 확인**

Expected: BossController errors=0.

- [ ] **Step 5: refresh + play(map03 보스) 실측**

`refresh` → `play` → 보스 맵 진입(노드에서 보스 분기 or `_GameConstants.MapBoss`). slam/redSmash windup 시 박스 판정 확인. redSmash 안에서 가만히=피격, **점프/위-대시로 박스 위로 올라가면 회피**(execute_script로 redSmash 레코드 hh 기준 위/안 케이스 + 실측). `logs` 명중/PARRIED 로그.

- [ ] **Step 6: stop + 커밋**

```bash
git add RootDesk/MyDesk/Enemy/Boss/BossController.mlua
git commit -m "feat(boss): slam 전방 박스 + redSmash 중앙 박스(점프/위-대시 회피)"
```

---

## Task 7: PlayerCombat — 커서 좌/우 전방 박스

**Files:**
- Modify: `RootDesk/MyDesk/Player/PlayerCombat.mlua` (`RequestAttack` 박스화, `lastAttackFacingX` 추가)

**Interfaces:**
- Consumes: `DamageEnemiesInBox`, `TryParry(box)` (Task 4).
- Produces: `property number lastAttackFacingX`(클라 기즈모용; 기본 1). **@Sync 아님** — TryAttack(ClientOnly)이 쓰고 CombatGizmo(ClientOnly)가 같은 로컬 클라에서 읽음(1인 1런).

- [ ] **Step 1: `lastAttackFacingX` 프로퍼티 추가**

`property number lastAttackTime = -999.0` 다음 줄에:

```lua
	-- 마지막 평타의 커서 좌/우 방향(+1 우 / -1 좌). 클라 기즈모가 평타 박스 그릴 때 사용. @Sync 불필요(로컬 클라 내 쓰기/읽기).
	property number lastAttackFacingX = 1
```

- [ ] **Step 2: 클라에서 facingX 기록 (TryAttack)**

`TryAttack`의 `self:RequestAttack(dir.x, dir.y)` 앞에 추가(클라가 시각 박스 방향도 알게):

```lua
		if dir.x < 0 then self.lastAttackFacingX = -1 else self.lastAttackFacingX = 1 end
```

- [ ] **Step 3: `RequestAttack`를 박스 판정으로**

`RequestAttack` 본문의 원형 판정/패링을 교체. 기존:
```lua
		local center = Vector2(pos.x, pos.y)
		local damage = ...
		local hitCount = _CombatPrimitives:DamageEnemiesInCircle(self.Entity.CurrentMap, center, _GameConstants.RadiusAttack, damage, "attack")
		local reflectDamage = ...
		local parried = _CombatPrimitives:TryParry(self.Entity.CurrentMap, center, _GameConstants.RadiusAttack, reflectDamage)
```
→
```lua
		local facingX = 1
		if dirX < 0 then facingX = -1 end
		local f = _GameConstants.PlayerAttackBoxForward
		local boxCenter = Vector2(pos.x + facingX * f * 0.5, pos.y + _GameConstants.PlayerCenterYOffset)
		local hw = f * 0.5
		local hh = _GameConstants.PlayerAttackBoxHeight * 0.5
		local damage = _GameStateManager.AttackStat * _GameConstants.DmgAttackPct
		local hitCount = _CombatPrimitives:DamageEnemiesInBox(self.Entity.CurrentMap, boxCenter, hw, hh, damage, "attack")
		local reflectDamage = _GameStateManager.AttackStat * _GameConstants.DmgReflectPct
		local parried = _CombatPrimitives:TryParry(self.Entity.CurrentMap, boxCenter, hw, hh, reflectDamage)
```

(`dirX`는 `RequestAttack(number dirX, number dirY)` 파라미터로 이미 있음. `dirY`는 미사용이어도 시그니처 유지.)

- [ ] **Step 4: diagnose 확인 (전체 호출부 정합)**

Expected: 모든 파일 errors=0 (CombatPrimitives/EnemyMelee/Boss/PlayerCombat 호출부 정합 완료).

- [ ] **Step 5: refresh + play 실측 (Part A 체크포인트)**

`refresh` → `play` → 전투 진입 → 좌클릭으로 적 타격:
- 커서를 적의 오른쪽/왼쪽에 두고 좌클릭 → 해당 방향 적만 명중(`logs` `hit=` 수). 반대편 적 빗나감.
- 노랑 적 공격 windup 중 그 방향 좌클릭 → 패링(`logs` PARRIED), 적 투사체 반사.
- 단위검증(execute_script): 플레이어 박스로 좌/우 적 BoxCircleOverlap 케이스.

- [ ] **Step 6: stop + 커밋**

```bash
git add RootDesk/MyDesk/Player/PlayerCombat.mlua
git commit -m "feat(player): 평타 360° 원→커서 좌/우 전방 박스 + lastAttackFacingX"
```

---

## Task 8: GizmoManager — 박스/레인/플래시박스 홀더

**Files:**
- Modify: `RootDesk/MyDesk/Player/GizmoManager.mlua` (슬롯 레이아웃 상수, BakeAll, 신규 메서드), `RootDesk/MyDesk/Core/GameConstants.mlua` (`GizmoLinePoolSize` 갱신)

**Interfaces:**
- Produces: `method void EnemyAttackBox(Vector2 center, number hw, number hh, boolean isRed)`, `method void AttackLane(Vector2 origin, Vector2 dir, number length, number width)`, `method void AttackFlash(Vector2 center, number hw, number hh)`(기존 `AttackFlash(center)` 원 → 박스로 시그니처 변경).

**슬롯 레이아웃(신규, 인덱스 27홀더 → 35로 확장):**
- 0 range(cyan circle) · 1 marker(yellow circle) · 2 ray(green seg) · 3~5 block(red box)
- 6 flash(**cyan box** — 플레이어 평타) · 7~14 proj(orange circle ×8)
- 15~20 atkY(**yellow box** ×6 — 적 공격 노랑) · 21~26 atkR(**red box** ×6 — 적 공격 빨강)
- 27~34 lane(**yellow box** ×8 — 원거리/triple 레인)

- [ ] **Step 1: GameConstants 풀 크기 35로**

`GameConstants.mlua`의 `property integer GizmoLinePoolSize = 27` → `= 35`. 주석의 레이아웃 설명도 위 슬롯 표로 갱신.

- [ ] **Step 2: GizmoManager 레이아웃 상수 + 레인 풀 추가**

`@HideFromInspector property integer AtkRStart = 21` / `AtkCount = 6` 뒤에:

```lua
	@HideFromInspector property integer LaneStart = 27
	@HideFromInspector property integer LaneCount = 8
	@HideFromInspector property integer laneCursor = 0
	@HideFromInspector property boolean laneOverflowed = false
```

- [ ] **Step 3: BakeAll — flash/atkY/atkR을 박스로, 레인 박스 bake**

`BakeAll`에서:
- `self:BakeCircle(self.IdxFlash, _GameConstants.RadiusAttack, ...)` → `self:BakeSquare(self.IdxFlash, Color(0.3, 0.8, 1.0, 0.85), cw)`.
- atkY/atkR 루프의 `BakeCircle(..., 1.0, ...)` 두 줄 → `BakeSquare(self.AtkYStart + ai, Color(1.0, 0.9, 0.2, 0.85), cw)` / `BakeSquare(self.AtkRStart + ai, Color(1.0, 0.2, 0.2, 0.9), cw)`.
- 레인 풀 bake 추가(루프):

```lua
		local li = 0
		while li < self.LaneCount do
			self:BakeSquare(self.LaneStart + li, Color(1.0, 0.9, 0.2, 0.85), cw)
			li = li + 1
		end
```

(투사체 7~14는 `BakeCircle` 유지, range/marker/block/ray 유지.)

- [ ] **Step 4: 프레임 커서 리셋에 laneCursor 추가**

`OnUpdate`의 두 군데 커서 리셋(bake 프레임 + 일반 프레임) `self.dotCursor = 0` 뒤에 각각 `self.laneCursor = 0` 추가. `self.overflowed = false` 옆에 `self.laneOverflowed = false`.

- [ ] **Step 5: 신규/변경 메서드 추가**

`EnemyAttack`/`Projectile` 인근에 추가(그리고 기존 `AttackFlash(center)` 원 메서드를 박스로 교체):

```lua
	@ExecSpace("ClientOnly")
	method void EnemyAttackBox(Vector2 center, number hw, number hh, boolean isRed)
		-- 적 공격 박스(노랑/빨강 풀 커서). AABB.
		local idx
		if isRed then
			if self.atkRCursor >= self.AtkCount then self:WarnOverflow("atkR") return end
			idx = self.AtkRStart + self.atkRCursor
			self.atkRCursor = self.atkRCursor + 1
		else
			if self.atkYCursor >= self.AtkCount then self:WarnOverflow("atkY") return end
			idx = self.AtkYStart + self.atkYCursor
			self.atkYCursor = self.atkYCursor + 1
		end
		self:PlaceBoxAABB(idx, center.x, center.y, hw, hh)
	end

	@ExecSpace("ClientOnly")
	method void AttackFlash(Vector2 center, number hw, number hh)
		-- 플레이어 평타 박스(하늘색 고정 슬롯).
		self:PlaceBoxAABB(self.IdxFlash, center.x, center.y, hw, hh)
	end

	@ExecSpace("ClientOnly")
	method void AttackLane(Vector2 origin, Vector2 dir, number length, number width)
		-- 원거리 예상 레인(OBB): 원점에서 dir로 length만큼 뻗는 회전 직사각형. 노랑 레인 풀 커서.
		if self.laneCursor >= self.LaneCount then self:WarnOverflow("lane") return end
		local idx = self.LaneStart + self.laneCursor
		self.laneCursor = self.laneCursor + 1
		local e = self:Holder(idx)
		if e == nil or isvalid(e) == false then return end
		local lrc = e.LineRendererComponent
		if lrc == nil or isvalid(lrc) == false then return end
		local len = length
		if len < 0.0001 then len = 0.0001 end
		local tf = e.TransformComponent
		if isvalid(tf) then
			tf.WorldPosition = Vector3(origin.x + dir.x * len * 0.5, origin.y + dir.y * len * 0.5, self.gizmoZ)
			tf.WorldZRotation = math.deg(math.atan(dir.y, dir.x))
			tf.Scale = Vector3(len, width, 1)
		end
		lrc.Enable = true
	end

	@ExecSpace("ClientOnly")
	method void PlaceBoxAABB(integer idx, number x, number y, number hw, number hh)
		-- 단위정사각 홀더를 AABB로 배치(rot=0, Scale=(2hw,2hh)).
		local e = self:Holder(idx)
		if e == nil or isvalid(e) == false then return end
		local lrc = e.LineRendererComponent
		if lrc == nil or isvalid(lrc) == false then return end
		local tf = e.TransformComponent
		if isvalid(tf) then
			tf.WorldPosition = Vector3(x, y, self.gizmoZ)
			tf.Scale = Vector3(hw * 2.0, hh * 2.0, 1)
			tf.WorldZRotation = 0
		end
		lrc.Enable = true
	end
```

기존 `EnemyAttack`(단위원)·`PlaceUnitCircle` 메서드는 제거(적 공격 원 미사용). `AttackFlash(center)` 원형 정의 제거.

- [ ] **Step 6: diagnose 확인**

Expected: GizmoManager errors=0. `CombatGizmo`의 `EnemyAttack`/`AttackFlash(center)`/`Projectile` 호출이 시그니처 불일치로 뜸(Task 9에서 교체) — `EnemyAttack`은 제거됐으니 not found.

- [ ] **Step 7: 커밋**

```bash
git add RootDesk/MyDesk/Player/GizmoManager.mlua RootDesk/MyDesk/Core/GameConstants.mlua
git commit -m "feat(gizmo): 적공격/플레이어평타 박스 홀더 + 회전 레인 홀더(풀 27→35)"
```

---

## Task 9: CombatGizmo — 박스 렌더 (브로드캐스트 경로)

**Files:**
- Modify: `RootDesk/MyDesk/Player/CombatGizmo.mlua` (`OnUpdate`의 공격 플래시 + 적 공격 렌더)

**Interfaces:**
- Consumes: `EnemyAttackBox`, `AttackFlash(center, hw, hh)` (Task 8); `clientEnemyAttacks` 항목의 `hw`/`hh` (Task 3); `PlayerCombat.lastAttackFacingX` (Task 7).

- [ ] **Step 1: 플레이어 평타 플래시를 박스로**

현재 CombatGizmo 플래시 블록은 `_GizmoManager:AttackFlash(Vector2(pp.x, pp.y))` (원형, 1인자). 이 한 줄을 박스로 교체(`pc`는 같은 블록에서 `---@type PlayerCombat local pc = self.combat`로 이미 캐스팅됨):

```lua
				local facingX = pc.lastAttackFacingX
				local f = _GameConstants.PlayerAttackBoxForward
				local bcx = pp.x + facingX * f * 0.5
				local bcy = pp.y + _GameConstants.PlayerCenterYOffset
				_GizmoManager:AttackFlash(Vector2(bcx, bcy), f * 0.5, _GameConstants.PlayerAttackBoxHeight * 0.5)
```

- [ ] **Step 2: 적 공격 원 → 박스 렌더**

`OnUpdate` 끝의 `GetClientEnemyAttacks()` 루프에서 현재 호출 `_GizmoManager:EnemyAttack(a.center, a.radius, isRed)` 한 줄을 교체(앞쪽의 `isRed` 계산 로직은 그대로; `a.radius`는 이제 없고 `a.hw/a.hh` 사용):

```lua
						_GizmoManager:EnemyAttackBox(a.center, a.hw, a.hh, isRed)
```

- [ ] **Step 3: diagnose 확인**

Expected: CombatGizmo errors=0.

- [ ] **Step 4: refresh + play 실측(스크린샷)**

`refresh` → `play` → 전투 진입. 근접적 windup 시 **노랑 박스**가 적 전방에, 좌클릭 시 **하늘색 박스**가 커서 방향에, 보스 slam 노랑 박스/redSmash 빨강 중앙 박스. `screenshot`로 확인.

- [ ] **Step 5: stop + 커밋**

```bash
git add RootDesk/MyDesk/Player/CombatGizmo.mlua
git commit -m "feat(gizmo): 적 공격/플레이어 평타 박스 렌더(브로드캐스트 경로)"
```

---

## Task 10: 원거리 조준 동기화 플래그

**Files:**
- Modify: `RootDesk/MyDesk/Enemy/EnemyRanged.mlua` (`@Sync IsAiming`), `RootDesk/MyDesk/Enemy/Boss/BossController.mlua` (`@Sync TelegraphTriple`)

**Interfaces:**
- Produces: `EnemyRanged.IsAiming`(@Sync boolean), `BossController.TelegraphTriple`(@Sync boolean).

- [ ] **Step 1: EnemyRanged `@Sync IsAiming`**

`property number cycleTimer = 0.0` 인근(프로퍼티 블록)에:

```lua
	-- 클라 기즈모용: aim(조준 캐스팅) 단계 동안 true. 원거리 예상 레인 표시 트리거.
	@Sync property boolean IsAiming = false
```

`OnUpdate`에서 aim 단계 진입/이탈 시 설정. 가장 간단히 `OnUpdate` 말미(모션 분기) 직전에 상태 반영 한 줄:
- `cyclePhase == "aim"`이고 감지 중일 때 true, 그 외(감지 이탈 return, 기절/은신/grace/사망 return, cooldown) false.
- 각 early-return 직전에 `self.IsAiming = false` 추가(사망/grace/stun/smoke/player nil/감지이탈 5곳), 그리고 사이클 분기에서 `if self.cyclePhase == "aim" then self.IsAiming = true else self.IsAiming = false end`를 모션 분기 근처에 둔다.

```lua
		-- (모션 분기 直前) 조준 단계 동기화
		if self.cyclePhase == "aim" then
			self.IsAiming = true
		else
			self.IsAiming = false
		end
```

- [ ] **Step 2: BossController `@Sync TelegraphTriple`**

프로퍼티 블록에:

```lua
	-- 클라 기즈모용: tripleShot windup 동안 true. 3갈래 예상 레인 표시 트리거.
	@Sync property boolean TelegraphTriple = false
```

`StartPattern`의 tripleShot 분기에서 `self.TelegraphTriple = true`, slam/redSmash 분기 + `ResolvePattern` 종료 + `CancelWindup` + 사망/grace/groggy early-return 직전에 `self.TelegraphTriple = false`. (tripleShot은 windup 동안만 true.)

- [ ] **Step 3: diagnose 확인**

Expected: 두 파일 errors=0.

- [ ] **Step 4: refresh + play 실측(execute_script)**

`refresh` → `play` → 원거리 적/보스 tripleShot 유발 후 `execute_script`로 동기화 확인:

```lua
local map = _UserService.LocalPlayer.CurrentMap
local rs = map:GetChildComponentsByTypeName("script.EnemyRanged", true)
for _, c in ipairs(rs) do log("[T10] ranged " .. c.Entity.Name .. " IsAiming=" .. tostring(c.IsAiming)) end
```

Expected: 조준 중인 원거리 적이 `IsAiming=true`.

- [ ] **Step 5: stop + 커밋**

```bash
git add RootDesk/MyDesk/Enemy/EnemyRanged.mlua RootDesk/MyDesk/Enemy/Boss/BossController.mlua
git commit -m "feat(enemy): 원거리 조준/보스 tripleShot 동기화 플래그(@Sync)"
```

---

## Task 11: CombatGizmo — 예상 레인 (클라 계산)

**Files:**
- Modify: `RootDesk/MyDesk/Player/CombatGizmo.mlua` (`OnUpdate`에 원거리/triple 레인 계산)

**Interfaces:**
- Consumes: `AttackLane` (Task 8); `EnemyRanged.IsAiming`/`BossController.TelegraphTriple` (Task 10); `GizmoRangedLaneLength/Width`, `BossTripleSpread` (Task 1).

- [ ] **Step 1: 원거리 단발 레인 + 보스 triple 3갈래 추가**

`CombatGizmo.OnUpdate` 끝(적 공격 박스 루프 뒤, `map` 유효 블록 내)에 추가. `playerCenter`는 로컬 플레이어 중심:

```lua
			local laneLen = _GameConstants.GizmoRangedLaneLength
			local laneW = _GameConstants.GizmoRangedLaneWidth
			local pc3 = _UserService.LocalPlayer.TransformComponent.WorldPosition
			local playerCenter = Vector2(pc3.x, pc3.y + _GameConstants.PlayerCenterYOffset)

			-- 원거리 단발: 조준 중 적 → 적→플레이어 1갈래
			local rangedList = map:GetChildComponentsByTypeName("script.EnemyRanged", true)
			if rangedList ~= nil then
				for _, compAny in ipairs(rangedList) do
					---@type EnemyRanged
					local comp = compAny
					local e = comp.Entity
					if isvalid(e) and comp.IsAiming == true then
						local ep = e.TransformComponent.WorldPosition
						local ec = Vector2(ep.x, ep.y + 0.5)
						local dir = _CombatPrimitives:DirectionTo(ec, playerCenter)
						_GizmoManager:AttackLane(ec, dir, laneLen, laneW)
					end
				end
			end

			-- 보스 tripleShot: windup 중 → ±BossTripleSpread 3갈래
			local bossList = map:GetChildComponentsByTypeName("script.BossController", true)
			if bossList ~= nil then
				local spread = _GameConstants.BossTripleSpread
				for _, compAny in ipairs(bossList) do
					---@type BossController
					local comp = compAny
					local e = comp.Entity
					if isvalid(e) and comp.TelegraphTriple == true then
						local bp = e.TransformComponent.WorldPosition
						local bc = Vector2(bp.x, bp.y + 0.5)
						local i = -1
						while i <= 1 do
							local target = Vector2(playerCenter.x, playerCenter.y + i * spread)
							local dir = _CombatPrimitives:DirectionTo(bc, target)
							_GizmoManager:AttackLane(bc, dir, laneLen, laneW)
							i = i + 1
						end
					end
				end
			end
```

- [ ] **Step 2: diagnose 확인**

Expected: CombatGizmo errors=0.

- [ ] **Step 3: refresh + play 실측(스크린샷, Part B 체크포인트)**

`refresh` → `play` → 원거리 적 조준 시 **노랑 레인 1갈래**(플레이어 추적), 보스 tripleShot windup 시 **3갈래**(±0.6)가 실제 발사 방향과 일치하는지 `screenshot`. 단발 발사 후 레인 사라지고 주황 투사체 원으로 전환.

- [ ] **Step 4: stop + 커밋**

```bash
git add RootDesk/MyDesk/Player/CombatGizmo.mlua
git commit -m "feat(gizmo): 원거리/보스 tripleShot 예상 공격 레인(회전 직사각형, 다갈래)"
```

---

## 최종 검증 (전체 통합)

- [ ] 모든 파일 `mlua-diagnose` errors=0, `refresh` 후 `logs(kind="build")` count=0.
- [ ] play map02(일반) + map03(보스) 통합:
  - 적 근접/보스 slam = 전방 박스 명중, 위/뒤 회피.
  - redSmash = 중앙 박스, 점프/위-대시로만 회피(좌우 도주 차단).
  - 플레이어 평타 = 커서 좌/우 박스 명중 + 패링(box-box).
  - 기즈모: 적공격 노랑/빨강 박스, 플레이어 하늘색 박스, 원거리 노랑 레인 1갈래, tripleShot 3갈래, 투사체 주황 원.
  - 런타임 로그 LEA-/Exception/nil = 0.
- [ ] 메모리 `combat-polish-session`/신규 메모리에 박스 판정 + 레인 기즈모 요점 기록. 티켓 MR-G 연계 노트.
