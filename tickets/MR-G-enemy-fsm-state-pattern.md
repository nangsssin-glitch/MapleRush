---
id: MR-G
title: 적 AI 상태패턴 정비 (ad-hoc 문자열 → FSM, 공격 모션/판정 분리)
status: todo
owner: unassigned
area: script
touches:
  - RootDesk/MyDesk/Enemy/EnemyMelee.mlua
  - RootDesk/MyDesk/Enemy/EnemyRanged.mlua
  - RootDesk/MyDesk/Enemy/Boss/BossController.mlua
  - RootDesk/MyDesk/Models/Enemies/
depends_on: []
branch: ""
created: 2026-06-20
updated: 2026-06-20
---

# 적 AI 상태패턴 정비 (ad-hoc 문자열 → FSM, 공격 모션/판정 분리)

## Goal
적 AI의 상태 관리를 **문자열 기반 ad-hoc 상태 머신**에서 **정식 FSM**(MSW `StateComponent` + `@State`, 또는 `msw-behaviourtree` BT)으로 정비한다. 특히 "공격 모션이 시작되면 조건과 무관하게 끝까지 수행/명중"되는 문제를 고쳐, **공격 모션과 명중 판정을 분리**하고 상태 전이로 중단(인터럽트)·취소가 깔끔하게 되도록 한다. 확장(기절/넉백/페이즈)도 쉬워진다.

## 현황 / 문제 (관찰)
- `EnemyMelee`: `property string aiState`("idle" / "windup" / "cooldown")를 `OnUpdate`에서 수동 분기·전이. 애니는 `PlayClip`(SpriteRUID 직접 교체)으로 구동 — `StateComponent`/`StateAnimationComponent` 미사용.
- `EnemyRanged`: `cyclePhase`("aim" 등) 동일 패턴.
- `BossController`: 패턴/그로기도 자체 상태 추정 — 확인 필요.
- **"공격 모션 무조건 수행"**: windup 진입 후 모션이 재생되며, 진행 중 플레이어가 이탈/조건 변화가 생겨도 상태가 도중 취소·전환되지 않고 사이클이 끝까지 굴러가는 경향. 모션(연출)과 hit 판정이 한 메서드에 묶여 있어 "모션=명중"으로 읽힘.
- 상태가 문자열이라 컴파일 타임 검증 없음, 전이 규칙이 흩어져 있어 유지보수/확장 취약.

## Acceptance criteria
- [ ] 적(근접/원거리) 상태가 **정식 FSM**으로 표현됨 (MSW `StateComponent`+`@State` FSM 또는 BT). 문자열 `aiState`/`cyclePhase` 수동 분기 제거.
- [ ] **공격 모션과 명중 판정 분리**: 모션 재생 ≠ 자동 명중. 명중은 별도 판정 시점에 조건(범위/시야/취소 여부)으로 결정.
- [ ] 공격 windup 중 **인터럽트/취소** 가능 (예: 플레이어 사거리 이탈 → Chase로 복귀, 기절/사망 → 즉시 중단). 조건 미충족 시 공격이 "무조건" 끝까지 가지 않음.
- [ ] 애니메이션이 상태에 종속(상태 전이 → 클립 전환). 가능하면 `StateAnimationComponent` 경로로 정리.
- [ ] 근접·원거리 둘 다 적용, **MapleTile·SideView 양쪽**에서 정상 동작 (회귀 없음).
- [ ] (선택) BossController도 동일 FSM 패턴으로 정리, 페이즈/그로기 전이 명시.

## Subtasks
<작업 시작 시 owner가 채움>
- [ ] 현행 EnemyMelee/EnemyRanged/BossController 상태·전이·애니 구동 방식 정밀 매핑
- [ ] FSM 방식 결정: `StateComponent`+`@State` vs `msw-behaviourtree` (트레이드오프 비교)
- [ ] 상태/전이/인터럽트 설계 → 모션·판정 분리 지점 정의
- [ ] 구현 + 양 맵모드 검증

## Notes / decisions
- MSW 레퍼런스: `msw-combat-system`(FSM/AI 표), `msw-general/references/animation-state.md`(StateComponent↔StateAnimationComponent 파이프라인, `ChangeState`/`AddState`/`SetActionSheet`, `[LEA-3005]`), `msw-general/references/monster.md`(몬스터 캐논 구성), `msw-behaviourtree`(BT 대안).
- 결정 포인트: 단순 적은 `StateComponent` FSM로 충분, 보스처럼 분기 많은 패턴은 BT가 유리할 수 있음.
- MR-B(보스 공격 애니메이션)와 연관 — 보스 FSM 정비 시 함께 고려.
- 현 적 모델은 MapleTile(Rigidbody) + SideView(Sideviewbody)+MovementComponent 듀얼바디(MR-S에서 추가). FSM 이동 분기는 기존 `GetMoveBody`/맵타입 분기 패턴 재사용.

## Verify
- Maker `play` → 적이 사거리 밖이면 공격 안 함 / windup 중 플레이어 이탈 시 공격 취소·추격 복귀 / 기절·사망 시 즉시 중단 → `logs`로 상태 전이 로그 확인.
- 근접·원거리·보스 각각 MapleTile·SideView에서 모션·판정 분리 동작 확인. build/runtime 에러 0.
