---
id: MR-D
title: 릴리스 정리 (디버그 경로 제거/게이팅)
status: backlog
owner: unassigned
area: script
touches:
  - RootDesk/MyDesk/Core/InputRouter.mlua
  - RootDesk/MyDesk/Player/PlayerCombat.mlua
  - RootDesk/MyDesk/Player/SlowMotion.mlua
depends_on: []
branch: ""
created: 2026-06-19
updated: 2026-06-19
---

# 릴리스 정리 (디버그 경로 제거/게이팅)

## Goal
테스트용 디버그 경로가 라이브에 남아 있다. 릴리스 전 제거하거나 게이팅한다. 기능 검증이 충분히 끝난 뒤 마지막 단계에서 진행 (그 전까지는 테스트에 유용하므로 유지).

## Acceptance criteria
- [ ] G키 `debugSlow`(InputRouter) 제거 또는 디버그 플래그로 게이팅
- [ ] `PlayerCombat.RequestDebugSlow`(현재 ungated) 제거 또는 게이팅
- [ ] (선택) 슬로우모션 '플레이어 제외' 방식 최종 결정 — 글로벌 타임스케일 유지 vs per-entity만

## Subtasks
- [ ] (작업 시작 시 owner가 채움)

## Notes / decisions
- 마지막에 진행 권장 (기능 테스트 도구로 쓰임).
- 슬로우모션 이슈: 현재 per-entity 서버 스케일(플레이어 제외 정상) + 글로벌 `SetClientTimeScale(0.25)`도 호출 → 플레이어 클라도 느려짐. 불릿타임 느낌 유지 vs 플레이어 풀스피드 중 결정 필요.

## Verify
- `play` → G키 등 디버그 입력이 더 이상 동작 안 하는지(또는 플래그 off 시) 확인.
