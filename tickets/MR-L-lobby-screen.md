---
id: MR-L
title: 로비 화면 신규 (LobbyGroup + 컨트롤러)
status: done
owner: D4LGONA
area: ui
touches:
  - ui/LobbyGroup.ui
  - RootDesk/MyDesk/UI/LobbyController.mlua
  - RootDesk/MyDesk/Stage/StageManager.mlua
depends_on: []
branch: "D4LGONA/MR-L-lobby-screen"
created: 2026-06-26
updated: 2026-06-29
---

# 로비 화면 신규

## Goal
게임 메인 로비 화면을 신규 제작한다. 메인 일러스트 배경 + 중앙 세로 텍스트 메뉴(구하러 가기/능력치 강화/설정/잠시 휴식하기). (UI 설계서 p.5 "게임 메인 [로비]")

## Acceptance criteria
- [x] 배경 일러: SpriteGUIRenderer로 메인 일러스트 표시 (야간 판타지 마을 `44f6448…` + 밤하늘 + 스타필드)
- [x] "구하러 가기" Button → `RequestStartRun` → StartRun + 1층 테마 선택 진입 (로그 검증)
- [~] "능력치 강화" Button → MR-O 컷 후보 → **회색 비활성 + "(준비 중)"** 표시 (핸들러 미연결)
- [x] "설정" Button → 플레이스홀더 팝업("준비 중" + 닫기)
- [x] "잠시 휴식하기" Button(라벨 유지) → **게임 종료 안내 팝업**(ESC/우상단 시스템 메뉴 안내 + 확인). MSW엔 스크립트 종료 API 없음 — 기획자 협의 예정
- [x] 입력 컨텍스트 = "Lobby" (비전투 — IsCombat()=false로 전투 입력 차단)

## Subtasks
- [x] `LobbyGroup.ui` 생성 (UIBuilder, 28엔티티): 배경 일러 + 타이틀 + 세로 4버튼 + 설정/휴식확인 팝업
- [x] 배경 일러스트 RUID (msw-search) 적용 — 야간 마을 `44f64481…`
- [x] `LobbyController.mlua` (@Component, ClientOnly): default_show 표시 + 4버튼 + 설정·휴식 팝업 제어 (9프로퍼티 바인딩)
- [x] `StageManager`: 부팅 자동 런시작 제거 → `OnPlayerReady`는 추적만, `RequestStartRun`(@Server) 신설
- [x] 버튼 분기: 구하러가기→RequestStartRun / 능력치강화→회색비활성 / 설정→플레이스홀더 / 휴식→확인팝업 후 숨김
- [x] 입력 컨텍스트 "Lobby" (전투 입력 차단)
- [x] Verify: build 0에러 / 로비 렌더 스크린샷 / 구하러가기→StartRun→테마선택 로그 검증

## Notes / decisions
- 🔴 신규 — `LobbyGroup.ui` + 컨트롤러 코드 미존재.
- "능력치 강화" 버튼은 MR-O 화면을 엶 → **MR-O가 컷되면 이 버튼은 숨김/비활성** 처리.
- 출처: `docs/maplerush_UI_ver1.pdf` p.5.
- **MSW 게임 종료 API 부재 (검증 완료)**: 전체 `Environment/NativeScripts`에 `Quit/Shutdown/Exit/Terminate/CloseApp` 메서드 0건. `ExitPopupOpened/ClosedEvent`는 시스템 종료 팝업 *수신 전용* 이벤트, `RoomService.MoveUsersToStaticRoom`은 룸 이동(종료 아님). 실제 종료는 MSW 클라이언트(ESC/우상단 메뉴)만 가능. → "잠시 휴식하기"는 종료 안내 팝업으로 처리. 기획자 협의 후 재정의 예정.

## Verify
- Maker `play` → 로비 표시 → 4개 버튼 각각 의도한 화면/동작으로 분기하는지 확인.
