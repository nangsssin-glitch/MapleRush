# MapleRush 티켓

작업 티켓을 **파일 1개 = 티켓 1개**로 관리합니다. (Jira의 가벼운 파일 버전)

- **티켓 추가/관리/세션 플랜 방법** → `maplerush-tickets` 스킬 호출 (Claude Code의 Skill 도구)
- **템플릿** → `.claude/skills/maplerush-tickets/ticket-template.md`
- **보드 보기** → `node .claude/skills/maplerush-tickets/board.cjs`

용도는 **계획·조율**입니다 (충돌 방지가 아님): 뭘 할지·다음 뭐 할지, 순서·의존성, 누가 뭐 잡았는지, 세션 플래닝.
상태는 각 파일 프론트매터 `status`로만 관리 (별도 인덱스 파일 없음 — 보드는 `board.cjs`로 생성).
개발자는 **dust9826 / D4LGONA** 둘. `owner`·`depends_on`가 핵심이고, 코드 머지는 그냥 git으로 — 충돌은 생기면 그때 해결합니다.

## 현재 MVP 로드맵 (테마1·1층 한 바퀴 완주)

| 티켓 | 내용 | 의존 |
|---|---|---|
| MR-S | 타일맵 모드 비교 스파이크 | — |
| MR-F | 밸런싱 값 외부화 (데이터셋) | — |
| MR-A | 일반 스테이지 맵 다양화 (3~4개) | MR-S |
| MR-B | 보스 공격 애니메이션 | — |
| MR-C | 상점 구매 확인 팝업 | — |
| MR-D | 릴리스 정리 (디버그 제거) | — |
| MR-E | 1층 완주 플레이테스트 (MVP 검증) | MR-A·MR-B·MR-C |

권장 진행: 회의 전 **MR-S + MR-F**, 독립 작업 **MR-B·MR-C·MR-D** 병행, **MR-A**는 모드 확정 후, 마지막 **MR-E**.
