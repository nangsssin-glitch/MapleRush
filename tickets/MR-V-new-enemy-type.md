---
id: MR-V
title: 신규 적 유형 추가 (EnemyAnimSet 다양화 — 모델 추가로 잡몹 1종+)
status: todo
owner: unassigned
area: mixed
touches:
  - RootDesk/MyDesk/Models/Enemies/
  - RootDesk/MyDesk/Enemy/EnemyAnimSet.mlua
  - RootDesk/MyDesk/Stage/StageManager.mlua
depends_on: [MR-U]
branch: ""
created: 2026-07-01
updated: 2026-07-01
---

# 신규 적 유형 추가 (EnemyAnimSet 다양화 — 모델 추가로 잡몹 1종+)

## Goal
MR-U(EnemyAnimSet)가 만든 "외형이 다른 몬스터를 **모델만 추가해 다양화**" 경로를 실제로 한 번 태워, 기존 근접/원거리와 외형(클립)이 다른 **신규 잡몹 1종 이상**을 추가한다. AI 로직 재작성 없이 모델 복사 + AnimSet 인스펙터 값 교체 + 스폰 풀 등록만으로 끝나는지 검증(= MR-U 설계 목표의 실사용 확인).

## 배경
- MR-U로 잡몹 클립이 `GameConstants` 하드코딩 → `EnemyAnimSet`(모델별 idle/run/attack/skill/groggy/hit/die `@Sync string` 인스펙터 필드)로 이관됨. 같은 AI(Melee/Ranged)라도 모델마다 다른 클립 렌더 가능.
- 따라서 신규 적 = 기존 `MeleeEnemy.model`/`RangedEnemy.model` 복사 → EnemyAnimSet 필드에 새 스프라이트 RUID 세팅 → 스폰 풀에 등록. (AI .mlua 수정 불필요가 기대치.)

## Acceptance criteria
- [ ] 추가할 적 1종 컨셉 확정(근접/원거리 중 택1 + 외형 스프라이트). (스프라이트는 msw-search로 idle/run/attack/hit/die 클립 RUID 확보)
- [ ] `RootDesk/MyDesk/Models/Enemies/`에 신규 적 `.model` 추가(ModelBuilder, 기존 잡몹 모델 복제 베이스). EnemyAnimSet 필드에 신규 클립 RUID 주입.
- [ ] 스폰/스테이지 풀에 신규 적 등록 → 일반 스테이지에서 등장.
- [ ] **AI .mlua(EnemyMelee/EnemyRanged) 수정 없이** 동작(다양화가 모델/인스펙터만으로 됨을 확인). 부득이 수정 시 사유 기록.
- [ ] 빌드 0에러. play 실측: 신규 적이 기존 적과 **다른 외형 클립**으로 stand/move/attack/hit/die 렌더, 피격·사망·HIT 상태 정상.

## Subtasks
<착수 시 owner가 채움>
- [ ] 적 컨셉·스프라이트 확정 (msw-search)
- [ ] 모델 복제 + EnemyAnimSet 값 세팅 (ModelBuilder)
- [ ] 스폰 풀 등록
- [ ] play 실측 (다양화·피격/사망·빌드 0에러)

## Notes / decisions
- 🔗 MR-U(EnemyAnimSet, done): 본 티켓의 토대. 다양화 = "모델 복사" 패턴(메모리 session-2026-07-01-enemy-animset).
- 🔗 MR-G(적 AI FSM 정비): AI 로직 자체 변경이 필요해지면 거기로. 본 티켓은 **로직 무변경 다양화**가 원칙.
- 🔗 MR-A(맵 다양화): 적 다양화와 함께 1층 콘텐츠 폭을 넓히는 결.
- ⚠ 스폰 풀 등록 위치(StageManager/FloorManager 등)는 착수 시 실제 코드 확인 후 확정.

## Verify
- 단계별 execute_script + play 실측: 신규 적 스폰 → 외형 클립이 기존과 다름 / 피격(hit)·사망(die)·HIT 공격중단 정상 / 빌드 로그 0에러. msw-scripting verify-checklist 준수.
