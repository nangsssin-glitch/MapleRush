---
id: MR-E
title: 1층 한 바퀴 완주 플레이테스트 (MVP 검증)
status: backlog
owner: unassigned
area: mixed
touches: []
depends_on:
  - MR-A
  - MR-B
  - MR-C
created: 2026-06-19
updated: 2026-06-19
---

# 1층 한 바퀴 완주 플레이테스트 (MVP 검증)

## Goal
MVP의 완료 판정: 테마1·1층을 끊김·반복 없이 한 바퀴 완주하고 "재밌는가"를 검증한다.

## Acceptance criteria
- [ ] 테마 선택 → 일반 4회(서로 다른 맵) → 상점(구매 확인 팝업 동작) → 보스(공격 애니 동작) → 클리어까지 끊김 없이 완주
- [ ] 사망→목숨 감소→재시작, 목숨 0→게임오버 정상
- [ ] 패링/그로기/대시/아이템/능력 한 바퀴 안에서 모두 정상 작동
- [ ] 빌드/런타임 로그 클린 (치명 에러 없음)
- [ ] 플레이 소감(재미/난이도/반복성)을 Notes에 기록

## Subtasks
- [ ] (작업 시작 시 owner가 채움)

## Notes / decisions
- MR-A/MR-B/MR-C 완료 후 진행. MR-D(디버그 정리)는 이 검증 후/병행.
- 검증은 반드시 실제 MCP 호출 (`play`→`mouse_input`/`keyboard_input`→`logs`) — 텍스트로 "동작함" 주장 금지 (AGENTS.md).

## Verify
- Maker `play` 풀 플레이스루 + 각 단계 `logs` 확인.
