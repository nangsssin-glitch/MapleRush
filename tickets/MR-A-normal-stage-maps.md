---
id: MR-A
title: 일반 스테이지 맵 다양화 (3~4개 수제작 + 랜덤 풀)
status: backlog
owner: unassigned
area: map
touches:
  - map/
  - RootDesk/MyDesk/Stage/StageManager.mlua
  - RootDesk/MyDesk/Core/GameConstants.mlua
  - RootDesk/MyDesk/Enemy/Projectile.mlua
depends_on:
  - MR-S
created: 2026-06-19
updated: 2026-06-19
---

# 일반 스테이지 맵 다양화 (3~4개 수제작 + 랜덤 풀)

## Goal
일반 4스테이지가 전부 같은 맵(map02)·같은 4스폰포인트라 한 바퀴가 반복적이다. **MR-S에서 확정한 타일 모드**로 테마1(오르비스/엘나스/폐광) 분위기 맵 3~4개를 만들고 랜덤 풀로 돌려 한 바퀴가 다양하게 느껴지게 한다.

## Acceptance criteria
- [ ] 일반 스테이지 맵 3~4개 제작 (확정 모드, Foothold/시작점/스폰포인트 정의)
- [ ] `StageManager`가 맵 풀에서 랜덤 선택(직전 맵 중복 방지) + 맵별 스폰포인트 사용
- [ ] 신규 맵 전부 `Global/SectorConfig.config`에 등록 (⚠️ Global/ 읽기전용 → 사용자가 Maker에서 수동 등록; 등록 목록은 owner가 작성해 전달)
- [ ] `Projectile` 맵 경계(현재 -12/14/-6/8 하드코딩, map01 전용)를 맵별/동적 처리로 변경 → 새 맵에서 투사체 소멸 정상
- [ ] 일반 4스테이지가 서로 다른 맵으로 진행됨을 플레이로 확인

## Subtasks
- [ ] (작업 시작 시 owner가 채움)

## Notes / decisions
- 🔒 **MR-S(타일 모드 확정) 선행 필수.** 모드 미정 상태로 맵 양산 금지.
- 설계는 20개+이지만 MVP는 3~4개로 충분 (stage_design §2.3.4).
- Foothold 배치 등은 Maker 에디터 작업이 필요할 수 있음 → 맵 지형은 사용자가 Maker에서, 스폰 데이터·풀 로직은 스크립트로 분업 가능.
- ⚠️ 겹침: StageManager.mlua / GameConstants.mlua를 MR-F·MR-B와 공유. 순서·분담 조율.

## Verify
- Maker `play` → 노드 진행하며 일반 4스테이지가 서로 다른 맵인지 + 투사체 소멸 정상인지 확인 → `logs`.
