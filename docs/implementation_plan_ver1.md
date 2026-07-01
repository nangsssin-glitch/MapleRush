# 메이플 러시 — 구현 우선순위 계획서 (ver1)

> **목적**: `player_design_doc_ver3.md` · `stage_design_doc_ver3.md` · `dev_quick_reference.md`를 기반으로, **서로 꼬이지 않게(의존성 역전·재작업 최소화)** 구현하기 위한 단계별 우선순위·산출물·완료 기준을 정의한다.
> **플랫폼**: MapleStory Worlds (MSW) / mlua. 대상 맵 `TileMapMode = 0` (MapleTile, 횡스크롤+중력, 플레이어 Body = `RigidbodyComponent`).
> **전제(런타임 실측 확정)**:
> - **C-1**: `_UtilLogic.ElapsedSeconds`·`ServerElapsedSeconds`는 `SetClientTimeScale`의 영향을 받지 않음(실제 시간). 느려지는 건 `OnUpdate`의 delta(0.25배)뿐.
> - **V1**: 서버에서 `MovementComponent.InputSpeed`/`SpriteRendererComponent.PlayRate`를 0.25배로 설정 → 이동·애니 정확히 0.25배 감속, 복구 정상.
> - **V2**: `FootholdComponent:Raycast(point, Vector2(0,-1), dist)`로 발판 끝(낭떠러지) 감지 정확.
> - **V4**: 런타임 위치 기반 원형 오버랩(`dist ≤ r1+r2`) 판정 정확 → 패링/짱돌 판정에 사용.
> - **갭①(해소)**: 플레이어 = 가로 1 × 세로 2(2등신), 모든 범위 base = 가로 1. 반지름(world unit): 평타 2 / 슬로우 트리거 1 / 근거리 감지 3·공격 1 / 원거리 감지 5 / 투사체 0.2 / 연막탄 3.
> - **갭②(해소)**: 적 공격/투사체마다 `parryable: boolean`. 색상(노랑/빨강)은 추후 이펙트 시각화, 판정은 boolean.

---

## 0. 꼬임 방지 핵심 원칙 (Anti-Tangling Rules) — 전 페이즈 공통

이 원칙을 **먼저 코드 컨벤션으로 고정**하고 시작한다. 이걸 어기면 후반에 전면 재작업이 발생한다.

1. **상수 단일 출처**: 모든 수치(플레이어 크기·반지름·ATK·목숨·캡·데미지%·타이머)는 `_GameConstants` 한 곳에서만 정의. **하드코딩 금지** → 밸런스 변경 시 1곳만 수정.
2. **타이머 규칙 고정**: 실제 시간 타이머는 **`ElapsedSeconds` 스냅샷 차분**(`now - start >= dur`)으로만 구현. ⛔ **`delta` 누산 금지**(슬로우 중 같이 느려짐). 슬로우에 *의도적으로* 느려져야 하는 적/이펙트만 delta 구동.
3. **서버 권위 vs 클라 연출 분리**: 게임 상태(HP·게이지·목숨·메소·스폰·피격판정)는 **서버 권위(`@ExecSpace("ServerOnly")` + `@Sync`)**. 슬로우 모션 `SetClientTimeScale`·UI·이펙트·사운드는 **클라(`ClientOnly`)**. 절대 혼동 금지.
4. **공통 원형 오버랩 유틸 1개**: 모든 범위 판정(평타·감지·패링·연막탄·트리거)은 **F5의 단일 `CircleOverlap(centerA, rA, centerB, rB)` 유틸**을 호출. 개별 구현 금지.
5. **공격 데이터 모델 통일(F5)**: 플레이어 공격/적 공격/투사체/아이템 공격 전부 `{center, radius, damage, parryable, owner, color}` 공통 구조로 표현. 패링·반사·짱돌이 이걸 재사용.
6. **스테이지 전환은 단일 초기화 함수 경유**: 진입/재시작/이탈 시 항상 `StageManager:ResetStage()` 하나만 호출(적·투사체 소멸 + 슬로우 해제 + 카운터/위치/목숨/임시메소 초기화). 부분 초기화 금지.
7. **1피격 즉사 + 다중피격 1회**: 플레이어 피격 처리는 **중앙 1곳(`PlayerHit`)**에서, 동일 프레임 다중 피격도 1회만. 각 적이 개별로 죽이지 않음(요청만 보냄). **대시 무적 시간(0.1s) 중에는 피격 무시**(무적 플래그를 PlayerHit이 확인).
8. **입력은 라우터 경유(F4)**: 좌클릭/우클릭/휠/숫자키는 `InputRouter`가 **현재 컨텍스트(전투/상점/보상/노드/팝업)**로 분기. 각 시스템이 직접 입력 이벤트를 듣지 않음 → 좌클릭 다중 의미(평타/아이템/구매/수령/선택) 충돌 방지.
9. **2개 이상 = 모델화 + RUID 비우지 않기**: 같은 적/오브젝트 ≥2 배치는 `.model` + `modelId`. `SpriteRUID` 빈 값 금지(보이지 않음). 리소스는 `msw-search`로 적용.
10. **네이티브 AI 비의존**: 적은 **커스텀 AI 컴포넌트**로 구현(네이티브 `AIWander`/`AIChase`는 커스텀 속도 제어와 충돌 — V1에서 확인). 기존 템플릿 몬스터의 AI/스크립트는 참고용.
11. **페이즈별 검증 필수**: 각 페이즈 끝에 `refresh → build 로그 0 → play → logs(positive 증거) → stop`. "오류 없음 ≠ 통과", 의도 동작의 로그 증거 확보 후 다음 페이즈.

---

## 1. 권장 폴더 / 스크립트 구조

`RootDesk/MyDesk/<Feature>/<Script>.mlua` (평탄 배치 금지). `.model`은 `RootDesk/MyDesk/Models/<Category>/`.

```
RootDesk/MyDesk/
├── Core/
│   ├── GameConstants.mlua      (@Logic) 모든 상수
│   ├── WallClock.mlua          (@Logic) 실제시간 타이머 유틸 (ElapsedSeconds 래퍼)
│   ├── CombatPrimitives.mlua   (@Logic) CircleOverlap·공격 데이터 구조(F5)
│   └── InputRouter.mlua        (@Logic) 컨텍스트별 입력 분기(F4)
├── Player/
│   ├── PlayerControllerCustom.mlua  이동/점프(필요 시 네이티브 위에 보강)
│   ├── PlayerAttack.mlua        평타(@Component on player)
│   ├── PlayerDash.mlua          대시 + 강화 대시
│   ├── SlowMotion.mlua          슬로우 모션 매니저
│   ├── PlayerHit.mlua           1피격 즉사·다중피격 1회·사망 요청
│   ├── PlayerParry.mlua         패링/반사
│   ├── AbilitySystem.mlua       능력(1슬롯)
│   └── ItemSystem.mlua          일회성 아이템(1~3키)
├── Enemy/
│   ├── EnemyAI.mlua             커스텀 AI 베이스(상태머신·감지·낭떠러지정지)
│   ├── EnemyMelee.mlua          근거리
│   ├── EnemyRanged.mlua         원거리
│   ├── Projectile.mlua          투사체(적/짱돌 공용)
│   └── Boss/
│       ├── BossController.mlua  HP·패턴풀·페이즈
│       ├── GroggyGauge.mlua     그로기 게이지(서버 권위)
│       └── Patterns/...         더미 패턴(플레이스홀더)
├── Stage/
│   ├── GameStateManager.mlua    (@Logic) 층·노드·메소·클리어수·영구강화
│   ├── StageManager.mlua        스테이지 수명/스폰/클리어/단일초기화(ResetStage)
│   └── RewardManager.mlua       보상 확률·지급
├── Node/  ThemePackSelect.mlua / NodeMap.mlua
├── Shop/  ShopManager.mlua
├── Meta/  MetaProgression.mlua  (DataStorage 영속)
├── UI/    HUD / Popup / Shop / Reward / Node ...
└── Models/
    ├── Enemies/ MeleeEnemy.model / RangedEnemy.model / Boss.model
    └── Projectiles/ EnemyProjectile.model
```

> `@Logic` 접근은 정확한 파일명: `_GameConstants`, `_WallClock`, `_CombatPrimitives`, `_InputRouter`, `_GameStateManager` (suffix 생략 금지).

---

## 2. 의존성 그래프 (요약)

```
Phase 0 (기반)  ─┬─ GameConstants ──────────────► (모두가 참조)
                 ├─ WallClock ─────────► 플레이어 타이머/아이템/그로기
                 ├─ CombatPrimitives(F5) ─► 평타/패링/감지/연막탄/투사체
                 └─ InputRouter(F4) ────► 평타/대시/능력/아이템/UI

Phase 1 (플레이어 코어) ─► 평타·대시·이동·HUD            [의존: P0]
Phase 2 (적+전투상호작용) ─► 적AI·투사체·패링·슬로우       [의존: P0,P1]
Phase 3 (스테이지 매니저) ─► 상태/수명/스폰/클리어/보상/사망 [의존: P0,P1,P2]
Phase 4 (능력+아이템) ─────────────────────────────────  [의존: P2,P3]
Phase 5 (상점+노드맵+층진행) ─────────────────────────── [의존: P3]
Phase 6 (보스) ──────────────────────────────────────── [의존: P2,P3]
Phase 7 (메타진행/영속) ─────────────────────────────── [의존: P3,P5,P6]
Phase 8 (콘텐츠/폴리시/밸런스) ─────────────────────────[의존: 전부]
```

**핵심 의존 규칙**: 슬로우 모션(P4 트리거)은 **적 공격이 존재해야** 테스트 가능 → 적(Phase 2)을 슬로우보다 먼저. 패링도 적 공격 의존 → 동일. 그래서 "플레이어 코어(Phase1)"와 "전투 상호작용(슬로우/패링, Phase2 후반)"을 분리한다.

---

## 3. 페이즈별 상세 계획

각 페이즈: **목표 / 선행 / 산출물 / 구현 항목 / 완료(검증) 기준 / 꼬임 주의**.

### Phase 0 — 기반 (Foundation) 🔧
- **목표**: 모든 시스템이 의존하는 공용 토대 확정. 이후 재작업 0을 위해 가장 먼저.
- **선행**: 없음.
- **산출물**: `Core/GameConstants`, `Core/WallClock`, `Core/CombatPrimitives`, `Core/InputRouter`, DefaultPlayer 크기(1×2) 세팅.
- **구현 항목**:
  - [ ] `GameConstants`: 플레이어 크기(1×2), 반지름 6종, ATK=10, 목숨=5, 대시2·회복2.5, 아이템3, 메소캡 4,294,967,295, 점수캡 65,535, 데미지%(평100/대시50/강대시150/반사200/짱돌300/패링충전=평×2), 타이머(평0.5·대시0.1·대시회복2.5·슬로우1·무적1·연막5·섬광3·섬광보스정지5·그로기3·조준1·쿨1).
  - [ ] `WallClock`: `Now()`(=`_UtilLogic.ElapsedSeconds`), `Elapsed(start)`, `IsExpired(start, dur)` 헬퍼. (서버용 `ServerElapsedSeconds` 버전 병행)
  - [ ] `CombatPrimitives(F5)`: `CircleOverlap(ca,ra,cb,rb)`; 공격 구조 `MakeAttack{center,radius,damage,parryable,ownerSide,color}`; 커서 방향 헬퍼(`GetCursorWorldDir(playerPos)` = `_InputService:GetCursorPosition` → `_UILogic:ScreenToWorldPosition`).
  - [ ] `InputRouter(F4)`: 컨텍스트 enum(Combat/Shop/Reward/Node/Popup), 좌/우클릭·휠·숫자키 이벤트를 컨텍스트별 콜백으로 분기. (`KeyboardKey.Mouse0/1/2`, `Alpha1~3`)
  - [ ] DefaultPlayer 모델: 크기·Body(Rigidbody, MapleTile) 확인, SpriteRUID 확보(만지 캐릭터는 `msw-search`).
- **완료 기준**: `_GameConstants`/`_WallClock`/`_CombatPrimitives`/`_InputRouter`가 play에서 nil 없이 호출되고, `CircleOverlap`·`WallClock:IsExpired`가 로그로 정확히 동작.
- **꼬임 주의**: 이 페이즈에서 **모든 수치를 GameConstants에 박아두고**, 이후 페이즈는 무조건 여기서 읽는다. 입력 라우터 스켈레톤을 먼저 만들어 두면 이후 좌클릭 충돌이 원천 차단된다.

### Phase 1 — 플레이어 코어 전투 ⚔️
- **목표**: 한 맵(map01)에서 이동·평타·대시가 동작하고 더미 몬스터에 데미지가 들어가는 **세로 슬라이스**.
- **선행**: Phase 0.
- **산출물**: `Player/PlayerAttack`, `Player/PlayerDash`, (이동 보강), `UI/HUD`(목숨·대시 게이지).
- **구현 항목**:
  - [ ] 평타: 좌클릭(InputRouter) → 커서 방향 반지름 2 원형 즉시 판정, ATK×100%, 쿨 0.5s(WallClock). 대시 이동 중 불가.
  - [ ] 대시: 우클릭 hold(조준)→release(실행), 360°, 거리 5(=플레이어 길이 5체), 0.1s, ATK×50%, **이동 0.1s 동안 무적(i-frame, 강화 대시 포함, 이동 종료 즉시 해제)**. 중력 맵에서 360°는 **PlayerController 비활성 후 Body 직접 제어**(또는 임펄스+위치보간). 횟수 2·회복 2.5s(WallClock), 0회 시 무동작.
  - [ ] HUD: 목숨·대시 게이지(WallClock 기준 갱신, 슬로우 무관).
- **완료 기준**: play에서 좌클릭 시 반경 2 내 더미 몬스터 HP 감소 로그, 우클릭 대시 이동+경로 적 ATK×50% 로그, 쿨/횟수/회복이 실제 시간으로 동작.
- **꼬임 주의**: 대시 360°를 중력 맵에서 구현하는 방식(임펄스 vs 위치제어)을 **여기서 확정**(이후 슬로우·강화대시가 이 위에 얹힘). 평타/대시 데미지는 F5 공격 구조로 발생.

### Phase 2 — 적 프레임 + 전투 상호작용 👾
- **목표**: 근/원거리 적이 행동하고, 패링/반사/슬로우까지 **핵심 전투 루프** 완성.
- **선행**: Phase 0, 1.
- **산출물**: `Enemy/EnemyAI`·`EnemyMelee`·`EnemyRanged`·`Projectile`, `Models/Enemies/*`, `Models/Projectiles/EnemyProjectile.model`, `Player/PlayerParry`, `Player/SlowMotion`, `Player/PlayerHit`.
- **구현 항목**:
  - [ ] `EnemyAI` 베이스: 상태(대기/추격/공격/복귀대기), 감지 원형(F5), **낭떠러지 정지(V2 `Raycast`)**, 추격 이동(`MovementComponent`).
  - [ ] 근거리 적: 감지 3·공격 1, 접근→공격(노랑 기본, `parryable=true`).
  - [ ] 투사체 시스템: 적 투사체(속도 10, 반지름 0.2, 직선, 벽/플랫폼/플레이어 충돌 시 소멸), `parryable` 플래그. **짱돌이 재사용**.
  - [ ] 원거리 적: 감지 5, 이동 + 조준 1s → 발사 → 쿨 1s 반복.
  - [ ] `PlayerHit`: 적 공격/투사체 원형이 플레이어 히트박스와 겹치면 **1피격 즉사 요청**(다중 1회). **단 대시 무적(0.1s) 중에는 피격 무시.** 사망 처리는 StageManager(Phase3)와 연결(임시 로그/리스폰 스텁).
  - [ ] 패링/반사: 평타 원형 ↔ `parryable=true` 적 공격 오버랩(F5/V4) → 근거리 무효화 / 투사체 반사(ATK×200%, 재피격 면제). `parryable=false`는 그대로 피격.
  - [ ] 슬로우 모션: 적 공격이 반지름 1 트리거 진입 + 대시 → 클라 `SetClientTimeScale(0.25)` + **서버 요청으로 적·투사체 InputSpeed/투사체속도/PlayRate 0.25배(V1)** + 강화 대시(ATK×150%, 횟수 미소모). 1s(WallClock) 후 전부 1.0 복구. 강화 대시 사용 즉시 해제.
- **완료 기준**: 근/원거리 적이 추격·공격·발사·낭떠러지 정지; 노란 공격 패링/반사 데미지 로그; 빨강 공격은 피격; 대시 회피 시 적만 0.25배 감속·플레이어 정상·1초 후 복구 로그.
- **꼬임 주의**: 슬로우·패링은 **반드시 적 공격이 F5 구조로 발생한 뒤** 구현. 슬로우 해제·스테이지 전환 시 적 속도 배율 원복을 `SlowMotion:Clear()`로 단일화(Phase3 ResetStage가 이걸 호출).

### Phase 3 — 스테이지 매니저 + 일반 스테이지 1개 완결 🎮
- **목표**: 진입→전투→클리어→보상→사망/재시작/게임오버가 도는 **1개 일반 스테이지 완결**.
- **선행**: Phase 0,1,2.
- **산출물**: `Stage/GameStateManager`, `Stage/StageManager`, `Stage/RewardManager`, `UI/Reward`.
- **구현 항목**:
  - [ ] `GameStateManager(@Logic)`: 메소, 일반/보스 클리어 수, 현재 층/노드, 사용 테마, 영구강화 값(서버 권위 + 동기화).
  - [ ] `StageManager`: 진입 시 목숨 최대치 갱신·능력 횟수 초기화·슬로우 클리어; 일괄 스폰(맵 스폰포인트); **클리어 = 스폰수==처치수 카운터**; **`ResetStage()` 단일 초기화**(적·투사체 소멸+슬로우 해제+카운터/위치/목숨/임시메소 초기화); 사망 → 목숨-1 재시작, 0에서 사망 → 게임오버.
  - [ ] 보상: 메소 100%(`일반 클리어수×10`) + 스탯50%/아이템70%/능력15% 독립 판정, 보상 UI(좌클릭 수령/버리기), 입력 비활성 처리.
- **완료 기준**: 한 일반 스테이지 진입→전멸→보상 UI→다음 진행, 사망 시 목숨 감소·재시작, 목숨 0 사망 시 게임오버 로그.
- **꼬임 주의**: 목숨/능력횟수/슬로우/메소 초기화는 **전부 `StageManager` 진입 훅 1곳**에서. Phase2의 `PlayerHit` 사망 요청을 여기 사망 처리에 연결.

### Phase 4 — 능력 + 일회성 아이템 🧪
- **목표**: 휠클릭 능력(2종) + 1~3키 아이템(3종) 동작.
- **선행**: Phase 2,3.
- **산출물**: `Player/AbilitySystem`, `Player/ItemSystem`, `UI/HUD`(능력 아이콘·아이템 슬롯).
- **구현 항목**:
  - [ ] 능력: 휠클릭(InputRouter), 1슬롯, 사용횟수(일반1/보스2, 진입 초기화). 임시 무적 1s(WallClock), 모든 투사체 무효화.
  - [ ] 아이템: 1~3키 활성화→좌클릭 사용(InputRouter 우선순위=아이템>평타), 재입력 비활성. 짱돌(커서방향·적 투사체 사양 재사용·ATK×300%), 연막탄(생성위치 고정·반지름3·5s·일반적 감지/조준 해제·보스 무시), 섬광탄(화면 내 전 일반적 3s 기절·보스 면역·보스 게이지 감소 5s 정지). 전투 스테이지에서만, 대시 이동 중 불가. 효과 지속은 WallClock.
- **완료 기준**: 능력/아이템 각각 의도 효과 로그(무적 중 무피격, 투사체 제거, 짱돌 명중 데미지, 연막 중 적 해제, 섬광 중 적 기절·보스 예외).
- **꼬임 주의**: "화면에 보이는 적" = 카메라 12.8×7.2 범위 판정. 아이템 효과 지속은 슬로우 무관(WallClock). 능력/아이템 사용 횟수 초기화는 StageManager 진입 훅에 연결.

### Phase 5 — 상점 + 노드맵 + 층 진행 🗺️
- **목표**: 거울 던전식 루프(테마팩→노드맵 N분기→상점→보스 자리) 완성.
- **선행**: Phase 3.
- **산출물**: `Shop/ShopManager`+`UI/Shop`, `Node/ThemePackSelect`·`NodeMap`+UI.
- **구현 항목**:
  - [ ] 상점: 품목 4종(최대목숨+1 100 / 스탯 50 / 능력 150 / 아이템 40), 최대 5표시, 좌클릭→"정말 구입?" 팝업→확정, 동일종 가격 2배 즉시 갱신(메소캡 내 오버플로 방지), 잔액부족/슬롯초과 처리, 나가기→다음 노드. 전투/사망 없음.
  - [ ] 노드맵: 일반 N회(1층4·2층5, `4+1·(층-1)`) 3분기 1택(전진만), 이후 상점→보스 고정 연결.
  - [ ] 테마팩 선택: 각 층 시작 시, 미플레이 테마만, 2종 구현(1층 2택→2층 1택). 사용테마 게임판 단위 관리.
- **완료 기준**: 1층 테마 선택→일반4회(분기)→상점(구매/갱신)→보스 자리→2층 테마(1종) 전환이 도는 것.
- **꼬임 주의**: 노드/상점은 **InputRouter 컨텍스트 전환**(Combat→Node/Shop)으로 좌클릭 의미 분리. 노드 진입마다 StageManager 진입 훅(목숨 갱신 등) 경유.

### Phase 6 — 보스 👑
- **목표**: 보스 그로기 시스템 + 패턴 풀 프레임(더미 패턴) + 보스 스테이지.
- **선행**: Phase 2,3.
- **산출물**: `Enemy/Boss/BossController`·`GroggyGauge`·`Patterns/*`, `Models/Enemies/Boss.model`, `UI/HUD`(보스 HP·그로기 게이지).
- **구현 항목**:
  - [ ] 그로기(서버 권위, `ServerElapsedSeconds`): 게이지 최대=최대HP×1/5, 충전(일반공격=명중데미지, 패링=(ATK×100%)×2, 반사=명중 시점 2배), 자동 감소 초당 2%(섬광탄 5s 정지·충전 가능), 100%→그로기 3s(이동·공격 정지)→0 초기화.
  - [ ] 패턴 풀: 가변 개수(3~5) 랜덤 선택 + 패턴 간 딜레이, 패턴별 색상(parryable). **더미 패턴 2~3개 플레이스홀더**(근거리/원거리 혼용).
  - [ ] 보스 스테이지: 처치→전체 보상 제시→다음 층 테마 선택. 재시작 시 HP·게이지 초기화(ResetStage 확장). 처치 직후 잔류 투사체/이펙트 소멸.
- **완료 기준**: 그로기 게이지 충전/감소/발동/3초/초기화 로그, 더미 패턴 랜덤 진행, 처치→보상→층 전환.
- **꼬임 주의**: 그로기·기절·정지 타이머는 **전부 서버 `ServerElapsedSeconds`**(슬로우 무관). 보스는 연막탄 무시·섬광탄 기절 면역(게이지 감소만 정지) 분기.

### Phase 7 — 메타 진행 / 영속 💾
- **목표**: 게임 클리어 → 영구 강화 점수 → DataStorage 영속 → 게임 시작 시 적용.
- **선행**: Phase 3,5,6.
- **산출물**: `Meta/MetaProgression`(+`UI/Meta` 플레이스홀더).
- **구현 항목**:
  - [ ] 점수 = `일반 클리어수 + (보스 클리어수 × 3)`, 게임오버 시 미지급, 캡 65,535.
  - [ ] DataStorage 영속(영구강화 값·점수): **캐시→더티체크→디바운스 flush**(OnUpdate/짧은타이머 호출 금지, 크레딧 과금 주의).
  - [ ] 영구강화로 변경된 기본값을 게임 시작 시 적용(예: 목숨 기본 5→6).
  - [ ] 메타 트리 UI: **별도 기획 필요 → 점수 적립/표시까지만, 소비 UI는 플레이스홀더**.
- **완료 기준**: 클리어 시 점수 적립·저장, 재시작 시 영구값 적용 로그.
- **꼬임 주의**: DataStorage 호출 패턴 위반 시 과금/렉. 게임판 상태(메소 등)와 영속 상태(영구강화)를 명확히 분리.

### Phase 8 — 콘텐츠 / 폴리시 / 밸런스 🎨
- **목표**: 실제 플레이 품질로 마감.
- **구현 항목**:
  - [ ] 맵 20개+ (사용자 직접 제작; §맵 제작 체크리스트), 중복방지 랜덤 선택, SectorConfig 등록.
  - [ ] 리소스 적용: 만지 캐릭터·적·투사체·이펙트·사운드 RUID(`msw-search`), SpriteRUID 비움 0.
  - [ ] 시각/청각 피드백: 패링/피격/그로기/슬로우 연출·사운드.
  - [ ] **PC 빌드 입력 확인**: 마우스 우클릭 hold/release·휠클릭(MCP 시뮬레이터 불가 → 실제 빌드).
  - [ ] 밸런스: 임시 수치(ATK·목숨·속도·확률·메소) 플레이테스트 후 조정 — 전부 `GameConstants` 1곳.

---

## 4. 마일스톤별 "플레이 가능" 상태

| 마일스톤 | 끝나면 가능한 것 |
|---|---|
| Phase 1 | map01에서 이동·평타·대시로 더미 몬스터 타격 |
| Phase 2 | 근/원거리 적과 싸우고 패링·반사·슬로우 회피가 되는 **전투 루프** |
| Phase 3 | 일반 스테이지 1개 진입→클리어→보상→사망/게임오버 |
| Phase 5 | 테마팩→노드맵→상점→(보스 자리)→다음 층의 **로그라이트 루프** |
| Phase 6 | 보스전(그로기·더미 패턴) 포함 1개 층 완주 |
| Phase 7 | 클리어 보상·영구강화 적용까지 **1회차 완결** |
| Phase 8 | 콘텐츠·연출·밸런스 갖춘 플레이 빌드 |

---

## 5. 미정 / 플레이스홀더 처리 원칙 (블로커 아님)

| 항목 | 처리 |
|---|---|
| 보스 패턴 구체 내용 | 시스템은 가변 풀로 선구현, 더미 패턴 2~3개(Phase 6) |
| 테마 2 배경/지역 | 시스템 N종 지원, 자리표시자(Phase 5) |
| 능력 전체 목록 | 정의된 2종 우선, 확장 가능 구조(Phase 4) |
| 아이템 추가 목록 | 3종 확정 구현, 표 확장 구조(Phase 4) |
| 메타 트리 UI | 점수 적립/저장까지, 소비 UI 플레이스홀더(Phase 7) |
| 맵 콘텐츠 | 사용자 제작(Phase 8) |
| 리소스 RUID | 구현 중 `msw-search`로 적용 |

---

## 6. 리스크 & 선검증 권장

| 리스크 | 대응 |
|---|---|
| 중력 맵에서 360° 대시(위/대각) 거동 | Phase 1에서 임펄스 vs 위치제어 방식 확정·소규모 검증 |
| 적 공격 히트박스 ↔ 평타 오버랩의 "동일 프레임 다중" 처리 | F5/`PlayerHit`에서 1회 판정 중앙화로 흡수(설계 완료) |
| DataStorage 과금/패턴 | Phase 7 진입 전 호출 패턴(캐시·디바운스) 리뷰 |
| 마우스 우클릭/휠 입력(시뮬레이터 불가) | Phase 1/4 구현 후 **PC 빌드에서 1회 확인** |
| 코옵 도입 시 슬로우/적감속 재설계 | 현재 1인 1런 전제로 진행, 코옵 착수 전 SlowMotion/적속도 경로 재설계 |

---

### 요약
- **Phase 0(기반: 상수·타이머·F5·입력라우터)을 가장 먼저** 고정하면 이후 꼬임이 원천 차단된다.
- **적(Phase 2)을 슬로우·패링보다 먼저** — 둘 다 적 공격에 의존한다.
- 각 페이즈는 **독립적으로 play 검증 가능한 세로 슬라이스**로 끝낸다.
- 미정 항목은 전부 플레이스홀더로 우회 가능 → **코드 착수에 블로커 없음**.
