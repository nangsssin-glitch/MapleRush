---
id: MR-S
title: 타일맵 모드 비교 스파이크 (MapleTile vs SideViewRectTile)
status: todo
owner: unassigned
area: map
touches:
  - map/
  - RootDesk/MyDesk/Models/
  - RootDesk/MyDesk/Player/
depends_on: []
branch: ""
created: 2026-06-19
updated: 2026-06-19
---

# 타일맵 모드 비교 스파이크 (MapleTile vs SideViewRectTile)

## Goal
같은 월드 안에 **MapleTile(=0)** 맵과 **SideViewRectTile(=2)** 맵을 각각 하나씩 빠르게 만들어 플레이어 조작감(이동/점프/대시/전투 위치잡기)을 직접 비교한다. 멘토링/회의 전까지 두 모드를 모두 만들어 비교 자료로 쓰고, **표준 모드는 회의 후 확정**한다. 이 결정이 MR-A(맵 양산)를 가른다.

## Acceptance criteria
- [ ] 같은 월드에 비교용 맵 2개 존재: MapleTile 1개 + SideViewRectTile 1개
- [ ] 각 모드에서 플레이어가 정상 이동·점프·대시 (모드↔Body 매칭 정확, `[LEA-3004]`·"안 움직임" 없음)
- [ ] 두 맵을 오가며 조작감 비교 가능 (포털/디버그 이동 등)
- [ ] 비교 소감/장단점을 이 티켓 Notes에 기록 (회의 자료)

## Subtasks
- [ ] (작업 시작 시 owner가 채움)

## Notes / decisions
- 현행 게임은 MapleTile 기반(map01~04, Rigidbody + Foothold). SideView로 표준화 시 기존 맵 + 플레이어/적 Body 마이그레이션 비용 발생 → 비교 결과에 이 비용도 감안.
- 모드↔Body: MapleTile→RigidbodyComponent / SideViewRectTile→SideviewbodyComponent. 잘못 짝지으면 무에러로 안 움직이거나 LEA-3004.
- MSW 규칙: 구현 전 msw-general + platform.md + platform-maple.md + platform-sideview.md 로드.

## Verify
- Maker `play` → 두 맵에서 각각 이동/점프/대시 실제 조작 → `logs`로 에러 없음 확인.
