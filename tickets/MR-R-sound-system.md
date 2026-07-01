---
id: MR-R
title: 사운드 시스템 (SoundManager + 볼륨 + SFX/BGM 배선, 타격음 포함)
status: in-progress
owner: D4LGONA
area: script
touches:
  - RootDesk/MyDesk/Core/HitFeedback.mlua
depends_on: []
branch: "D4LGONA/sound-volume-settings"
created: 2026-07-01
updated: 2026-07-01
---

# 사운드 시스템 (SoundManager + 볼륨 + SFX/BGM 배선, 타격음 포함)

## Goal
게임 전반의 사운드를 중앙 `SoundManager` 경유로 통일한다. 모든 SFX는 `SoundManager.PlaySFX`, 배경음은 `PlayBGM`으로 재생하고 볼륨을 제어한다. 여기에 **MR-Q 타격감의 타격음**을 포함해 실제로 소리가 나도록 마무리한다. (작업은 기존 브랜치 `D4LGONA/sound-volume-settings`에서 진행)

## Acceptance criteria
- [ ] `SoundManager`(SFX/BGM 재생 + 볼륨 API)가 마스터에 통합
- [ ] 모든 게임 SFX가 `SoundManager.PlaySFX` 경유(직접 `_SoundService:PlaySound` 산재 금지), BGM은 `PlayBGM`
- [ ] **타격음(MR-Q) 연결** — 적 타격 시 타격음 1회 재생. `HitFeedback`의 SFX 재생을 SoundManager 경유로 전환하고 타격음 RUID 지정
- [ ] 볼륨 설정이 실제로 SFX/BGM에 반영
- [ ] build/runtime 에러 0

## Subtasks
- [ ] (작업 시작 시 owner가 채움)
- [ ] SoundManager 설계/통합 (기존 sound-volume-settings 브랜치 정리)
- [ ] 타격음 SFX RUID 확보(msw-search) + HitFeedback 연결 (현재 `_SoundService:PlaySound` 직접 호출 → SoundManager 경유로 교체)
- [ ] 기타 핵심 SFX 배선(버튼/공격/획득 등) — 범위 협의

## Notes / decisions
- 관련 메모리 [[sound-volume-architecture]]: 모든 SFX는 SoundManager.PlaySFX 경유(전역 SFX 볼륨 API 없음), 배경음은 PlayBGM.
- **MR-Q 연계**: `HitFeedback.mlua`가 현재 `_SoundService:PlaySound(HitSfxId, HitSfxVolume)`로 타격음 훅만 있고 `HitSfxId=""`라 소리 안 남. 이 티켓에서 SoundManager 경유로 바꾸고 타격음 에셋 지정하면 MR-Q 타격음 완성. (MR-Q PR #27은 훅까지만 포함)
- master 기준엔 아직 SoundManager 없음 → 이 티켓/브랜치에서 도입.

## Verify
- Maker `play` → 적 타격 시 타격음 재생 확인, 볼륨 조절 반영 확인, 로그로 SoundManager 경유 확인.
