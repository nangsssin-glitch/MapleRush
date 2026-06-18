---
id: MR-F
title: 밸런싱 값 외부화 (기획자 편집용 데이터셋)
status: todo
owner: unassigned
area: data
touches:
  - RootDesk/MyDesk/Core/GameConstants.mlua
  - RootDesk/MyDesk/Data/
depends_on: []
branch: ""
created: 2026-06-19
updated: 2026-06-19
---

# 밸런싱 값 외부화 (기획자 편집용 데이터셋)

## Goal
기획자가 코드 없이(바이브코딩 또는 Maker 에디터로) 밸런스를 조절할 수 있도록, `GameConstants`에 흩어진 **밸런스 값**을 UserDataSet(CSV 기반)으로 분리한다. VFX·RUID·오프셋 등 개발 전용 값은 코드에 남긴다.

## Acceptance criteria
- [ ] 밸런스 값(아래 목록)이 UserDataSet으로 분리되어 Maker/CSV에서 편집 가능
- [ ] `GameConstants`가 시작 시 데이터셋을 읽어 적용하고, 값 누락 시 코드 기본값으로 fallback
- [ ] 데이터셋 값만 바꿔도 (코드 수정 없이) 인게임 밸런스가 바뀜을 1개 값으로 검증
- [ ] 어떤 값이 데이터셋이고 어떤 값이 개발 전용인지 구분 주석/문서

## Subtasks
- [ ] (작업 시작 시 owner가 채움)

## Notes / decisions
- 방식: **UserDataSet (CSV 기반)** — MSW 정석. 사용자가 "CSV여도 OK"라 확정. 구현 전 msw-general/references/dataset.md 로드 (ClientOnly 주의: `_LocalizationService` 등).
- **외부화 대상 (밸런스):** 플레이어 스탯(BaseAttack/BaseMaxLives/BaseMaxDash/BaseDashRecoverTime/BaseMaxItems), 데미지 배율(Dmg*Pct/GroggyParryMult), 타이머(AttackCooldown/Dash*/Slow*/Smoke/Flash*/Groggy*/RangedAim/RangedFireCooldown/ProjectileSpeed), 적(*EnemyHP/EnemyMoveSpeed/BossHP/GroggyGaugeRatio/GroggyDecayPerSec/BossPatternDelay), 경제·보상(MesoPer*/Price*/Reward*Chance), 진행(Floor1NormalStages/MaxFloors/AbilityUses*).
- **코드 유지 (개발 전용):** Mat*/Dash*Clip/Dash*Model*/AttackEffect*/EnemyHitEffect*/*MoveClip/*AttackClip/Radius* 등 RUID·VFX·물리 반경.
- ⚠️ 겹침 주의: 이 티켓은 GameConstants.mlua를 크게 건드림 → MR-A, MR-B도 같은 파일 일부 수정. owner 간 순서/분담 조율 필요.

## Verify
- 데이터셋에서 BaseAttack 값 변경 → `play` → 평타 데미지가 바뀌는지 로그로 확인 → 코드 변경 0건 확인.
