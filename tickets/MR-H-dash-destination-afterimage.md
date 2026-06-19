---
id: MR-H
title: 대시 도착 지점 표시 개선 (플레이어 잔상 + MapleTile 중력 낙하 보정)
status: todo
owner: unassigned
area: script
touches:
  - RootDesk/MyDesk/Player/PlayerDash.mlua
  - RootDesk/MyDesk/Player/PlayerBootstrap.mlua
  - RootDesk/MyDesk/Models/Effects/DashDestMarker.model
depends_on: []
branch: ""
created: 2026-06-20
updated: 2026-06-20
---

# 대시 도착 지점 표시 개선 (플레이어 잔상 + MapleTile 중력 낙하 보정)

## Goal
대시 조준 시 "어디에 도착하는지"를 더 자연스럽고 정확하게 보여준다. 현재는 도착 지점에 **스킬 이펙트 느낌의 마커 스프라이트**(DashDestMarker)를 띄우는데, 이를 **플레이어의 잔상(afterimage/ghost)** 으로 바꿔 실제 착지 모습을 직관적으로 보여주는 것이 목표. 더불어 MapleTile에서 표시 도착점과 실제 착지점이 어긋나는 문제를 보정한다.

## 현황 / 문제
- 도착 마커 위치는 **플레이어 중심 기준으로 조정 완료**(MR-S 대시 폴리싱: `UpdateAimPreview`가 `center(pos.y+PlayerCenterYOffset)+dir×L`로 마커 배치). → 이 부분은 이미 반영됨.
- **MapleTile 불일치**: 대시 종료점이 공중이면 중력으로 발판까지 낙하 → 마커가 가리킨 지점 ≠ 실제 최종 착지점. (수평 대시는 일치, 공중 종료 대시는 어긋남.)
- **표시 방식**: 현재 `DashDestMarker.model`(스킬 이펙트풍 스프라이트, RUID 548acc99…). 사용자 선호 = **플레이어 아바타 잔상**을 도착 지점에 반투명으로 표시 → "여기에 이렇게 서 있게 된다"가 한눈에.

## Acceptance criteria
- [ ] 조준 중 도착 지점에 **플레이어의 모습(반투명 잔상)** 이 표시됨 (현재 캐릭터 외형 반영).
- [ ] 잔상은 플레이어 중심 기준 정렬, 실제 착지 자세/위치와 시각적으로 일치.
- [ ] MapleTile에서 공중 종료 대시 시 **실제 착지점(중력 낙하 후 발판 위)** 을 반영하거나, 최소한 어긋남이 자연스럽게 보이도록 보정.
- [ ] SideView·MapleTile 양쪽에서 자연스럽게 동작. build/runtime 에러 0.

## Subtasks
<작업 시작 시 owner가 채움>
- [ ] 아바타 잔상 구현 방식 조사 (msw-avatar: CostumeManager 복제 / AvatarRenderer 자식 / thumbnail:// 등 비용·가능성 비교)
- [ ] 도착 지점 엔티티를 잔상 렌더러로 교체 (또는 DashDestMarker를 아바타 렌더러로)
- [ ] MapleTile 중력 낙하 예측(전방/하향 풋홀드 레이캐스트로 실제 착지 y 산출) 또는 시각 보정
- [ ] 양 맵모드 검증

## Notes / decisions
- 잔상 구현 후보:
  1. 도착 지점 자식 엔티티에 `AvatarRendererComponent` + 플레이어 `CostumeManagerComponent` 복제 → 가장 정확하나 비용·동기화 이슈. (msw-avatar 참조)
  2. `thumbnail://` 로 아바타 썸네일 스프라이트 표시 (정적, 자세 반영 안 됨).
  3. 플레이어 실루엣 스프라이트(고정) — 가장 싸지만 외형 반영 X.
- 대시 자체 연출(`StartDashFx`)은 이미 플레이어 아바타에 `SetAlpha(DashGhostAlpha)` 고스트 + ShadowAssault 이펙트 사용 중 — 도착 잔상과 톤 맞추기.
- MapleTile 착지 y 예측: `EnemyMelee`의 전방 하향 `FootholdComponent:Raycast` 패턴 재사용 가능. SideView는 RectTile 지면.
- 마커 중심 정렬은 MR-S에서 이미 반영(중복 작업 주의).

## Verify
- Maker `play` → 우클릭 조준 → 도착 지점에 반투명 플레이어 잔상이 실제 착지 위치에 표시되는지 (MapleTile/SideView 각각). 대시 실행 후 실제 착지점과 잔상 위치 일치 확인.
