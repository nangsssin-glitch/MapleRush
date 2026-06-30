---
id: MR-U
title: 적 애니메이션 클립 Component화 (EnemyAnimSet — 몬스터 다양화 기반)
status: review
owner: dust9826
area: mixed
touches:
  - RootDesk/MyDesk/Enemy/EnemyAnimSet.mlua
  - RootDesk/MyDesk/Enemy/EnemyMelee.mlua
  - RootDesk/MyDesk/Enemy/EnemyRanged.mlua
  - RootDesk/MyDesk/Enemy/Boss/BossController.mlua
  - RootDesk/MyDesk/Core/GameConstants.mlua
  - RootDesk/MyDesk/Models/Enemies/
depends_on: []
branch: "feat/MR-U-enemy-animset"
created: 2026-06-30
updated: 2026-06-30
---

# 적 애니메이션 클립 Component화 (EnemyAnimSet — 몬스터 다양화 기반)

## Goal
적 애니메이션 클립을 `GameConstants` 평면 상수에서 **엔티티별 편집 가능한 Component(`EnemyAnimSet`)** 로 이관한다. 같은 종류(근접/원거리)라도 몬스터마다 stand/move/attack/skill/groggy 클립을 Maker 인스펙터에서 개별 지정 → **외형이 다른 몬스터를 모델만 추가해 다양화**할 수 있게 한다. (히트박스를 HitComponent.BoxSize로 뺀 것과 동일 결의 리팩터.)

## 배경 (현재 → 목표)
- 현재 Pattern A(직접 `SpriteRUID` 스왑, 각 AI의 `PlayClip`). 네이티브 StateAnimationComponent/ActionSheet 미사용.
- 클립 출처가 분산: **잡몹**(EnemyMelee/EnemyRanged)은 `GameConstants.MeleeMoveClip/MeleeAttackClip/RangedMoveClip/RangedAttackClip`를 하드코딩 → **모든 근접몹이 동일 클립**(다양화 불가). **보스**(BossController)는 이미 모델주입 per-model 속성(MoveClip/AttackClip/SkillClip/GroggyClip + `ClipOr` 폴백)을 가짐.
- `stand` 클립은 모델 기본 `SpriteRendererComponent.SpriteRUID`를 OnBeginPlay에 캡처하는 방식(상수 아님).

## 설계 결정 (추천안)
- **`@Component EnemyAnimSet`**: 상태별 `@Sync property string` 필드 — `StandClip`(선택 override), `MoveClip`, `AttackClip`, `SkillClip`, `GroggyClip`, `HitClip`, `DeadClip`. 빈 문자열 = "미지정". **인스펙터에서 모델별 RUID 편집**.
- **`method string Clip(string key)`**: 딕셔너리식 접근자. key ∈ `stand/move/attack/skill/groggy/hit/dead` → 해당 필드(없으면 `""`).
- ⚠ **왜 named-field인가**: MSW `SyncDictionary`는 인스펙터 편집 불가(default 리터럴 불가, UI 없음) → "인스펙터에서 쉽게 조정" 목적에 안 맞음. named string 필드는 인스펙터 편집되고 `Clip(key)`가 딕셔너리 인터페이스를 제공. (임의 키가 꼭 필요하면 대안=SyncDictionary 코드 주입 or CSV 데이터셋이나, 본 티켓은 인스펙터 편집 우선.)
- **하위호환 폴백**: AI는 `EnemyAnimSet` 있으면 거기서 읽고, 없거나 빈값이면 `GameConstants` 클립으로 폴백. `stand`는 컴포넌트 StandClip 빈값 시 기존처럼 모델 기본 SpriteRUID.
- **보스 마이그레이션**: BossController의 MoveClip/AttackClip/SkillClip/GroggyClip 속성 → EnemyAnimSet으로 통합(보스 모델의 주입값을 EnemyAnimSet 필드로 이동). 분산 제거.

## Acceptance criteria
- [ ] `RootDesk/MyDesk/Enemy/EnemyAnimSet.mlua` 신규: 상태별 `@Sync property string` + `Clip(key)` 접근자.
- [ ] 적 모델에 `EnemyAnimSet` 부착: MeleeEnemy / RangedEnemy / BossElija / BossSnowman / BossZakum / BossEnemy(더미) / TrainingDummy. (ModelBuilder)
- [ ] EnemyMelee / EnemyRanged / BossController가 클립을 `EnemyAnimSet`에서 읽음(OnBeginPlay 캐시), 없거나 빈값이면 GameConstants 폴백.
- [ ] BossController의 per-model 클립 속성 제거 → EnemyAnimSet으로 통합(보스 모델 주입값 이동, 동작 동일).
- [ ] **다양화 검증**: 같은 근접몹 모델 2종(또는 한 모델의 AnimSet 값 변경)으로 서로 다른 stand/move/attack 클립이 인스펙터 설정만으로 렌더됨.
- [ ] GameConstants 클립 상수는 폴백 기본값으로 유지(또는 미사용 시 주석 표기).
- [ ] 빌드 0에러. play 실측: 각 적 stand→move→attack 클립 스왑 정상, 보스 skill/groggy 정상.

## Subtasks
- [x] 1) `EnemyAnimSet.mlua` 작성 (Stand/Move/Attack/Skill/Groggy/Hit/Dead `@Sync string` + `Clip(key)` 접근자) → refresh
- [x] 2) AI 3종(Melee/Ranged/Boss) 클립 읽기를 `AnimClip(key, fallback)`(EnemyAnimSet 경유 + GameConstants 폴백)으로 교체. stand는 OnBeginPlay에 AnimSet StandClip override.
- [x] 3) 적 모델 7종에 EnemyAnimSet 부착. 보스 3종은 BossController 주입 클립값을 EnemyAnimSet으로 이관, 잡몹/더미는 빈셋(폴백). (ModelBuilder)
- [x] 4) BossController per-model 클립 속성(MoveClip/AttackClip/SkillClip/GroggyClip) + ClipOr 제거 → AnimClip 통합. 보스모델 고아 값 제거.
- [x] 5) play 실측: 빌드 0에러. 멜리=폴백 경로 / 보스(zakum)=이관값(move=429420f7…) AnimClip 정확 반환 확인. 런타임 에러 0.

> ✅ 구현 완료 (review). 잔여=리뷰/머지. 잡몹 per-monster 클립은 인스펙터에서 채워 다양화(현재 빈셋=GameConstants 폴백).

## Notes / decisions
- 🔗 MR-T(보스): BossController 클립 주입을 본 티켓이 EnemyAnimSet으로 대체. 두 티켓 touches 겹침(BossController) — MR-T PR(#22) 머지 후 진행 권장.
- 🔗 MR-F(밸런싱 외부화): 같은 "상수→인스펙터/데이터" 결. 임의키·기획자 일괄편집이 필요해지면 CSV 데이터셋(MR-F)으로 확장 가능.
- Pattern A 유지(직접 SpriteRUID 스왑). 네이티브 StateAnimationComponent 전환은 범위 밖(대규모 AI 개편).
- 폴백 안전: 컴포넌트/필드 누락 시 GameConstants로 떨어져 회귀 없음.

## Verify
- 단계별 execute_script 단위검증 + play 실측(적별 클립 스왑, 보스 skill/groggy). msw-scripting verify-checklist 준수. 빌드 로그 0에러.
