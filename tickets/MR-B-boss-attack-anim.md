---
id: MR-B
title: 보스 공격 애니메이션 추가
status: in-progress
owner: D4LGONA
area: script
touches:
  - RootDesk/MyDesk/Enemy/Boss/BossController.mlua
  - RootDesk/MyDesk/Core/GameConstants.mlua
depends_on: []
branch: ""
created: 2026-06-19
updated: 2026-06-19
---

# 보스 공격 애니메이션 추가

## Goal
보스 공격 패턴(slam/tripleShot/redSmash) 자체는 동작하나 **공격 애니메이션이 없어** 밋밋하다. 근접/원거리 적과 동일한 방식(`SpriteRendererComponent.SpriteRUID` 스왑)으로 보스에 공격 모션을 입혀 층 클라이맥스의 타격감을 살린다. (패턴 3종 더미는 유지 — 패턴 추가는 MVP 범위 외)

## Acceptance criteria
- [ ] 보스 공격 패턴 발동 시 공격 모션이 재생됨 (stand↔attack 전환)
- [ ] 패턴별로 적절한 모션 매핑 (근접 slam / 원거리 tripleShot 등)
- [ ] 그로기/사망 시 모션이 stand로 정상 복귀 (잔류 모션 없음)

## Subtasks (D4LGONA, 2026-06-19)
- [ ] 보스 모델(map03 보스) 확인 → 기본 SpriteRUID(stand) 파악
- [ ] msw-search로 보스 공격 모션 클립 RUID 선정 (근접 slam / 광역 redSmash / 원거리 tripleShot용)
- [ ] GameConstants에 보스 공격 클립 상수 추가 (Boss*Clip — 기존 Melee*/Ranged* 패턴과 동일)
- [ ] BossController에 standClip 캡처(OnBeginPlay) + PlayClip(ruid) 메서드 이식 (EnemyMelee와 동일 방식, @Sync 자동 반영)
- [ ] StartPattern: 패턴별 windup 진입 시 해당 공격 모션 재생 (slam/tripleShot/redSmash)
- [ ] ResolvePattern / CancelWindup / 그로기·사망·그레이스 분기에서 stand 복귀 (잔류 모션 방지)
- [ ] Verify: Maker play → 보스전 3패턴 모션 재생 + 그로기·처치 후 stand 복귀 + logs 에러 없음

## Notes / decisions
- 기존 패턴: BossController에 slam/tripleShot/redSmash. 적 애니 방식은 이미 EnemyMelee/EnemyRanged가 `SpriteRUID` 스왑 + `PlayClip`(변경 시만 set)으로 구현됨 — 같은 패턴 재사용.
- 공격 모션 스프라이트/클립 RUID 선정은 msw-search 사용. RUID는 GameConstants에 상수로 보관(기존 *AttackClip 패턴과 동일).
- 모드 독립 — MR-S/MR-A 결과와 무관하게 선행 가능.

## Verify
- Maker `play` → 보스전에서 각 패턴 발동 시 모션 재생 확인 → 그로기/처치 후 stand 복귀 확인 → `logs`.
