---
id: MR-B
title: 보스 공격 애니메이션 추가
status: todo
owner: unassigned
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

## Subtasks
- [ ] (작업 시작 시 owner가 채움)

## Notes / decisions
- 기존 패턴: BossController에 slam/tripleShot/redSmash. 적 애니 방식은 이미 EnemyMelee/EnemyRanged가 `SpriteRUID` 스왑 + `PlayClip`(변경 시만 set)으로 구현됨 — 같은 패턴 재사용.
- 공격 모션 스프라이트/클립 RUID 선정은 msw-search 사용. RUID는 GameConstants에 상수로 보관(기존 *AttackClip 패턴과 동일).
- 모드 독립 — MR-S/MR-A 결과와 무관하게 선행 가능.

## Verify
- Maker `play` → 보스전에서 각 패턴 발동 시 모션 재생 확인 → 그로기/처치 후 stand 복귀 확인 → `logs`.
