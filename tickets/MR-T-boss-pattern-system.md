---
id: MR-T
title: 보스 패턴 시스템 (3보스 9패턴 + 예고 게이지 + 패링 윈도우 + 거리밴드 선택)
status: in-progress
owner: dust9826
area: mixed
touches:
  - RootDesk/MyDesk/Enemy/BossController.mlua
  - RootDesk/MyDesk/Core/CombatPrimitives.mlua
  - RootDesk/MyDesk/Player/PlayerCombat.mlua
  - RootDesk/MyDesk/Stage/GroggyGauge.mlua
  - RootDesk/MyDesk/Core/GameConstants.mlua
  - RootDesk/MyDesk/Models/
depends_on: []
branch: ""
created: 2026-06-29
updated: 2026-06-30
---

# 보스 패턴 시스템 (3보스 9패턴 + 예고 게이지 + 패링 윈도우 + 거리밴드 선택)

## Goal
`docs/boss_design_doc.md`(2026-06-28 확정본) 기준으로 보스 전투를 구체화한다. 현재 `BossController`의 더미 3슬롯(slam/tripleShot/redSmash) + 단일 phaseTimer 랜덤 선택을 → **테마별 3보스(엘리쟈·스노우맨·자쿰) × 3패턴(총 9)** 으로 리스킨하고, **예고 게이지 / 근접 패링 윈도우 / 거리밴드 패턴선택 / 사각 판정 통일** 을 신규 구현한다. 1피격 즉사 전제이므로 모든 패턴은 회피 또는 패링 가능해야 한다.

> 설계 원문: `docs/boss_design_doc.md` (§1 공통원칙 / §2 보스별 / §3 패턴 9개 스펙 / §4 코드매핑·외부화 / §5 TODO). 연계 설계: `docs/stage_design_doc_ver3.md` §1.4.

## 배경 (현재 코드 → 목표)
- MR-B에서 보스 모션(windup→resolve→delay) + 머쉬맘 더미 클립 구현됨. MR-K에서 HP·그로기 오버레이 구현됨. **본 티켓은 그 위에 패턴/판정/예고를 얹는다.**
- 3보스 **난이도 대등**: HP 800 / 그로기 최대 = HP×1/5 / windup·쿨 골격 공통. 차별화는 **패턴 구성·히트박스 형태·근접 발동 사거리·연출**로만.

## Acceptance criteria
- [ ] **9패턴 리스킨**: 슬롯 매핑(§4.1) — `tripleShot`=P-O1(3발)/P-E2(1발)/P-Z2(박수 수평1발), `redSmash`=P-O2/P-E3/P-Z3, `slam`=P-O3(엘리쟈는 광역②로 리스킨,parryable=false)/P-E1/P-Z1. 발수·박스크기·좌우/다지점·수평고정·parryable을 슬롯 파라미터로 분기
- [ ] **예고 게이지(§1.5, 우선순위 높음)**: 근접·광역 = 판정 위치 바닥에 ↑사각(Filled Vertical), 원거리 = 보스 중심→바깥 방향 사각. 차는 시간=windup, 가득=resolve. 색=노랑/빨강. windup 진입 시 생성, resolve·사망·그로기·그레이스에서 정리
- [ ] **근접 판정 사각형 통일**: 보스 근접 원형 → 박스(`RegisterEnemyAttackBox`/`DamageEnemiesInBox`/`BoxBoxOverlap`). 예고 사각형 = 실제 판정 히트박스 일치
- [ ] **근접 패링 윈도우(§1.4)**: `TryParry` 근접 분기에 시간 게이트 `hitAt − 0.15s ≤ now ≤ hitAt + 0.05s`(ε 선행0.15·후행0.05). 투사체 반사 분기는 불변
- [ ] **패턴 선택 = 거리밴드+우선순위+개별 쿨(§1.6)**: 가로거리 d로 CLOSE(광역>근접>원거리)/MID(광역>원거리)/FAR(원거리) 밴드. 패턴별 개별 쿨타임(광역은 근접·원거리의 2~3배). 광역 배치 사거리=6, 쐐기=±5
- [ ] **자쿰 박수 레이저(P-Z2)**: 박수 모션 후 플레이어 행(수평 고정 y=0) 빠른 투사체 1발(기존 Projectile 재사용, Parryable=true) + 빔 비주얼
- [ ] **보스 스프라이트/클립 RUID**: `msw-search`로 엘리쟈(어둠)·스노우맨·자쿰 stand/move/attack/skill/hit 선정 → `GameConstants` 상수화(현재 더미=머쉬맘)
- [ ] **외부화(§4.2, MR-F 연계)**: 보스별 MaxHP/그로기/추격속도/근접발동사거리/RUID + 패턴별 windup/cooldown/parryable/히트박스/배치사거리/게이지형태·색 + 전역 패링윈도우 ε·거리밴드 경계
- [ ] **사망/그로기 정리(§4.4)**: 보스 사망·CancelWindup 시 투사체(P-O1 3발/P-Z2)·예고 게이지·잔존 광역 박스 즉시 소멸. ResolvePattern tail 자기파괴 가드 유지(LEA-2011 회귀 방지)
- [ ] **실측(play)**: 3보스 각 패턴 발동·예고·패링/회피·그로기 충전·사망 정리 정상. 빌드 0에러

## Subtasks (세션별로 쪼갬 — 큰 티켓이라 단계 진행)
- [x] 1) 판정 사각화 + 예고 게이지(공통 인프라) — ✅ 2026-06-29. Telegraph 모듈(Service/Renderer/TelegraphGauge.model, **PixelRenderer 솔리드색**, 월드 Scale.y 성장). 판정은 RegisterEnemyAttackBox 박스 사용. 풀@map03 검증.
- [x] 2) 근접 패링 윈도우(hitAt±ε) — ✅ 2026-06-30. `TryParry` 근접 분기에 `hitAt − ParryWindowLead(0.15) ≤ now ≤ hitAt + ParryWindowTrail(0.05)` 시간 게이트. 밖이면 MISTIMED 로그+패링 미성립. 투사체 반사 분기 불변. ε는 GameConstants 외부화. (빌드OK, 라이브 타이밍 검증=MR-E)
- [x] 3) 패턴 선택 거리밴드+개별쿨 엔진 — ✅ 2026-06-30. `SelectPattern(d)`: CLOSE(d≤4=광역>근접>원거리)/MID(d≤7.5=광역>원거리)/FAR(원거리). 패턴별 가용 쿨다운 `patReadyAt`(resolve 시 now+cd 등록)로 우선순위 시스템이 광역 무한반복 안 하게. 밴드 전부 쿨 중이면 최단 readyAt 폴백. curCd 제거, 패턴간 공통간격=BossPatternDelay. 밴드경계 GameConstants 외부화.
- [x] 4) 보스별 패턴 파라미터 외부화 + 슬롯 리스킨(엘리쟈/스노우맨/자쿰) — ✅ 2026-06-29. BossController 재작성(BossKind별 3패턴, box forward/self/player/sides/multi + ranged fan/single/horizontal, 다중박스). 수치 전부 GameConstants "보스 패턴 수치" 섹션. 런타임 3보스 검증.
- [x] 5) 자쿰 박수 레이저 비주얼 + 보스 RUID 선정/적용 — **보스 RUID ✅**(엘리쟈=Eliza팩 / 스노우맨=Snow Yeti / 자쿰=mob9303089, 보스별 클립 BossController 주입). **자쿰 P-Z2 빔 비주얼 ✅ 2026-06-30**: `BossController.ShowZakumBeam`(@Client) — P-Z2 resolve 시 발사 행을 따라 fieldskill 가로 레이저 클립(`3a2ea8cf…`) PlayEffect. 판정은 기존 투사체(parryable) 유지, 빔은 연출 전용. 수치 `GameConstants.BossZakumBeamClip/ScaleX(길이)/ScaleY(두께)/OffsetX` 외부화(눈 튜닝용). play 검증: P-Z2 강제발동 ×4 → zakum beam fx ×4, 런타임 에러 0, 가로 황금 레이저 렌더 스샷 확인.
- [~] 6) 사망/그로기/그레이스 정리 경로 보강 + 실측 — 예고게이지 정리(HideTelegraph 리스트)·다중박스 cancel ✅. 투사체 정리는 ResetStage 의존. 전체 실측은 MR-E.

### 2026-06-29 세션 추가 산출물 (티켓 외 보강)
- **조준 위치 고정**: 보스 tripleShot/원거리적이 발사순간이 아닌 **조준시작 시점에 방향 @Sync 고정**(추적 금지). EnemyRanged.AimDir* / BossController.AimTarget* / CombatGizmo.
- **디버그 보스 직행 치트**: CheatMode+전투에서 **숫자키 6** → FloorManager.DebugWarpBoss → StartStage("boss"). 현재 테마 보스로.
- **보스맵 정책**: 지금=(a) **map03 단일 보스맵 + 테마 맞는 보스 런타임 소환**(StageManager가 CurrentTheme로 선택). 나중=(c) 테마별 보스맵 분리 + .map 미리배치(맵 정리 MR-A 후).

## ▶ 다음 세션 시작점 (이어서 진행)
1. **눈 확인 튜닝**(빠름): 6번 워프로 테마별 보스 보면서 — 예고게이지 크기 `GameConstants.TelegraphPxBaseWorld`(=0.16) / 보스 `Scale`(각 모델 2.2). 안 맞으면 한 값씩 조정.
2. ~~subtask 2 근접 패링 윈도우~~ — ✅ 2026-06-30 완료 (위 Subtasks 참조). 라이브 타이밍감(±ε) 튜닝은 6번 워프 보스전에서 확인.
3. ~~subtask 3 거리밴드 선택~~ — ✅ 2026-06-30 완료. 밴드경계(BossBandClose=4 / BossBandMid=7.5) 라이브 튜닝은 보스전에서.
4. ~~subtask 5 자쿰 박수 레이저 빔 비주얼~~ — ✅ 2026-06-30 완료(ShowZakumBeam + GameConstants 외부화). 빔 길이/두께/오프셋(BossZakumBeamScaleX/Y/OffsetX) 라이브 눈 튜닝은 보스전에서. **남은 코드작업 없음 → 잔여는 전부 라이브 튜닝(MR-E) + 아래 6번 선택사항.**
5. (보류) **DebugSettings 인스펙터 편집**: 디버그 토글(CheatMode/DrawGizmo/TelegraphPxBaseWorld)을 @Component로 노출해 Maker 인스펙터에서 편집(@Logic은 인스펙터 미노출). 범위·배치 위치 사용자 확정 필요.
6. **(선택) 보스 HP 단일화**: EnemyHealth 보스일 때 `GameConstants.BossHP` 읽도록(현재 모델 MaxHP=500 하드코딩).

## Notes / decisions
- **MR-B/MR-K가 전제(done)** — 모션·HP/그로기 오버레이 기반 위에 구축. 본 티켓은 패턴/판정/예고/선택로직.
- 🔗 **MR-F**(밸런싱 외부화): 본 티켓의 외부화 항목과 한 쌍 — 보스 수치는 MR-F 데이터셋/상수로.
- 🔗 **MR-E**(플레이테스트): HP/windup/쿨/박스/사거리/패링윈도우 최종 튜닝은 MR-E에서.
- 🔗 **MR-A/MR-R**(테마맵·맵 레지스트리): 보스 스테이지 맵 연결은 별개 트랙. 본 티켓은 보스 엔티티/전투 로직 중심.
- 서버 권위(§4.3): 패턴 판정·패링 윈도우·거리밴드·그로기 전부 서버, 시간은 `ServerElapsedSeconds`. 예고 게이지 진행은 서버 windup 종속, 클라 표시만.
- 단일 플레이어 런 전제([[single-player-run-assumption]]).

## Verify
- (작성 예정) 단계별 execute_script 단위검증 + play 실측. msw-scripting verify-checklist 준수.
