---
id: MR-B
title: 보스 공격 애니메이션 추가
status: review
owner: D4LGONA
area: script
touches:
  - RootDesk/MyDesk/Enemy/Boss/BossController.mlua
  - RootDesk/MyDesk/Core/GameConstants.mlua
depends_on: []
branch: "D4LGONA/boss-attack-anim"
created: 2026-06-19
updated: 2026-06-19
---

# 보스 공격 애니메이션 추가

## Goal
보스 공격 패턴(slam/tripleShot/redSmash) 자체는 동작하나 **공격 애니메이션이 없어** 밋밋하다. 근접/원거리 적과 동일한 방식(`SpriteRendererComponent.SpriteRUID` 스왑)으로 보스에 공격 모션을 입혀 층 클라이맥스의 타격감을 살린다. (패턴 3종 더미는 유지 — 패턴 추가는 MVP 범위 외)

## Acceptance criteria
- [x] 보스 공격 패턴 발동 시 공격 모션이 재생됨 (stand↔attack 전환)
- [x] 패턴별로 적절한 모션 매핑 (근접 slam / 원거리 tripleShot 등)
- [x] 그로기/사망 시 모션이 stand로 정상 복귀 (잔류 모션 없음)

## Subtasks (D4LGONA, 2026-06-19)
- [x] 보스 모델(map03 보스) 확인 → 기본 SpriteRUID(stand) 파악 — 머쉬맘(mob/6130101), stand=86015373…
- [x] msw-search로 보스 공격 모션 클립 RUID 선정 (근접 slam / 광역 redSmash / 원거리 tripleShot용)
- [x] GameConstants에 보스 공격 클립 상수 추가 (Boss*Clip — 기존 Melee*/Ranged* 패턴과 동일)
- [x] BossController에 standClip 캡처(OnBeginPlay) + PlayClip(ruid) 메서드 이식 (EnemyMelee와 동일 방식, @Sync 자동 반영)
- [x] StartPattern: 패턴별 windup 진입 시 해당 공격 모션 재생 (slam/tripleShot/redSmash)
- [x] ResolvePattern / CancelWindup / 그로기·사망·그레이스 분기에서 stand 복귀 (잔류 모션 방지)
- [x] Verify: Maker play → 보스전 3패턴 모션 재생 + 그로기·처치 후 stand 복귀 + logs 에러 없음

## Notes / decisions
- 기존 패턴: BossController에 slam/tripleShot/redSmash. 적 애니 방식은 이미 EnemyMelee/EnemyRanged가 `SpriteRUID` 스왑 + `PlayClip`(변경 시만 set)으로 구현됨 — 같은 패턴 재사용.
- 공격 모션 스프라이트/클립 RUID 선정은 msw-search 사용. RUID는 GameConstants에 상수로 보관(기존 *AttackClip 패턴과 동일).
- 모드 독립 — MR-S/MR-A 결과와 무관하게 선행 가능.

### 구현 결과 (2026-06-19)
- 보스 = 머쉬맘(`mob/6130101`). 같은 패밀리 클립으로 매핑(stand↔attack 크기 일관):
  - 추격 → `move`(BossMoveClip), slam → `attack1`(BossAttackClip), redSmash/tripleShot → `skill1`(BossSkillClip), 대기/복귀 → stand(런타임 캡처).
  - tripleShot/redSmash는 skill1 공유 — 패턴이 "추후 보스 확정 후 재기획"(stage_design §1.4.3) 대상이라 전용 모션 과투자 회피.
- BossController에 OnBeginPlay(stand 캡처) + PlayClip 추가, StartPattern 3분기 + ResolvePattern + 그로기/그레이스/무플레이어 분기 stand 복귀.
- 사망: EnemyHealth.Die()가 엔티티 즉시 Destroy → 잔류 모션 불가(검증 불필요).
- ⚠️ §1.4.4 "사망 시 잔류 투사체·이펙트 소멸"은 모션이 아닌 tripleShot 투사체 정리 → MR-B 범위 밖. 미구현이면 별도 티켓 필요.
- Verify(Maker play, map01에 보스 스폰): build 0 err. windup→공격클립 스왑 / delay→stand 복귀 / 3패턴(SLAM/RED SMASH/TRIPLE SHOT) 모두 발동.

### 추가 (2026-06-20): 그로기 모션 + LEA-2011 진단
- 그로기 상태에 전용 모션 추가: `BossGroggyClip = hit1`(`90fee941…`). 그로기 분기에서 stand 대신 hit1 재생 → 비틀거리는 무방비 연출(머쉬맘 팩에 전용 stun 클립 없어 hit1 차용). Verify: 그로기 3초 내내 90fee941 유지 확인.
- ⚠️ 보스전 `[LEA-2011] 'PlayClip' is nil` 1차 보고 → 처음엔 stale codeblock으로 추정했으나, **죽고 재시작 시 재현**되어 재조사 → **실제 버그(내 회귀) 확정 + 수정**:
  - **근본 원인(재진입/자기파괴)**: slam/redSmash의 `ResolvePattern`이 `hitComp:RequestHit()` 호출 → 플레이어 사망 → `OnPlayerDeath` → `ResetStage`가 **동기적으로 이 보스를 Destroy**. 제어가 ResolvePattern으로 복귀해 다음 줄 `self:PlayClip(self.standClip)` 실행 → 파괴된 self의 메서드는 nil → LEA-2011. (기존 코드는 그 자리에 속성 쓰기만 있어 무해했는데, MR-B에서 메서드 호출을 추가해 노출됨.)
  - **수정**: ResolvePattern tail에 `if isvalid(self.Entity) == false then return end` 가드.
  - **동일 잠복 버그**: `EnemyMelee`도 RequestHit 직후 `self:PlayClip(self.standClip)` 호출 → 같은 가드 적용. (`EnemyRanged`는 투사체가 RequestHit를 하므로 자기파괴 없음 — 무영향. `Projectile`은 RequestHit 뒤 네이티브 `Destroy`만 호출 — 무영향.)
  - **Verify(보스 스테이지 16초 스트레스, 사망→재시작 6회, boss:redSmash 직접 처치 경로 포함)**: LEA-2011 0건, 보스 매번 정상 재스폰·패턴 지속.

## Verify
- Maker `play` → 보스전에서 각 패턴 발동 시 모션 재생 확인 → 그로기/처치 후 stand 복귀 확인 → `logs`.
