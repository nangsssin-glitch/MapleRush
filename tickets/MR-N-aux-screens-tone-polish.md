---
id: MR-N
title: 보조 4종 색·아이콘 게임 톤 정비 (+토스트 GroupOrder 수정)
status: in-progress
owner: D4LGONA
area: ui
touches:
  - ui/PopupGroup.ui
  - ui/ToastGroup.ui
  - ui/GameOverGroup.ui
  - ui/GameClearGroup.ui
  - ui/RewardGroup.ui
depends_on: []
branch: "D4LGONA/MR-N-aux-screens-tone-polish"
created: 2026-06-26
updated: 2026-06-28
---

# 보조 4종 색·아이콘 게임 톤 정비

## Goal
보조 화면 4종(구매확인 팝업 / 토스트 / 보상 / 게임오버·클리어)의 색·아이콘을 게임 톤으로 정비한다. (UI 설계서 p.13~14 "보조 화면 ①·②")

## Acceptance criteria (디자인 재설계 — 색만 X)
- [x] 구매 확인 팝업: **"구입 확인" 타이틀 + 크림슨 구분선** + 다크 네이비 패널 + 확인=크림슨/취소=다크 (PDF p.13)
- [x] 노드 선택(NodeSelectGroup): **3카드 재설계**(일반 A/B/C + 청록 액센트 + 아이콘 + "랜덤 적 구성") + "다음 스테이지 선택" 타이틀 + 푸터 (PDF p.9)
- [x] 보상(RewardGroup): **카드 재설계**(상단 컬러 액센트 + 컬러 아이콘 + 라벨) 스탯=청록/아이템=노랑/능력=빨강 + "다음으로" (PDF p.14). "롤된 보상만"은 기존 Open 로직이 이미 처리
- [x] 결과(GameOver/GameClear): **레이아웃 재설계** — 타이틀+액센트바 + 스탯/점수 라인 + **다시 도전 / 로비로 2버튼**(로비 라우팅 신설) (PDF p.14)
- [x] **토스트 z-order**: `ToastGroup` GroupOrder **4→20** (최상단)
- [~] 토스트 성공/실패 색 구분·누적: **후속**(ShowMessage 시그니처 변경 — 콜러 영향). 게임오버 영구점수 적립: 후속(로직)

## Subtasks
- [x] 6종 현황 스냅샷 + 컨트롤러 바인딩 분석 → PDF p.9/13/14 갭
- [x] ToastGroup GroupOrder 4→20
- [x] PopupGroup: 타이틀 "구입 확인" + 구분선 + 다크/크림슨 톤
- [x] RewardGroup: 카드 재설계(액센트+아이콘+라벨) + 다음으로
- [x] NodeSelectGroup: 3카드 재설계 + 타이틀/푸터 (+컨트롤러 타이틀 문구)
- [x] GameOver/GameClear: 레이아웃 재설계 + "로비로" 버튼 (컨트롤러 OnLobbyClick 신설)
- [x] Verify: build 0에러, 6화면 스크린샷 확인(보상/노드/게임오버/클리어/팝업)
- [ ] (후속) 토스트 성공/실패 색·누적, 보상 수령/버리기 세분화, 게임오버 영구점수 적립

## Notes / decisions
- 토스트 GroupOrder=5 현재값은 ShopGroup(7)보다 낮아 상점 위 토스트가 가려짐 — MR-C 작업 중 발견된 잠재 이슈를 여기서 처리(권장 20).
- **노드 선택 화면**은 기존 3택 구조와 정합(추가 작업 거의 없음, 설계서 p.9) — 별도 티켓 없이 색/아이콘 정비 시 함께 점검.
- 출처: `docs/maplerush_UI_ver1.pdf` p.9, p.13, p.14.

## Verify
- Maker `play` → 구매/획득/실패 시 토스트 색·페이드 확인, 상점 위에서도 토스트가 앞에 뜨는지, 게임오버/클리어 색 전환 확인.
