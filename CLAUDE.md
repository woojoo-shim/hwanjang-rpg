# 환장 RPG — CLAUDE.md

## 프로젝트 개요
Three.js 기반 3D 판타지 RPG. 단일 HTML → 멀티파일 구조로 리팩토링 후 Vercel 배포 + 멀티플레이 추가 진행 중.

## 기술 스택
- **프론트엔드**: 순수 HTML/CSS/JS (빌드 도구 없음), Three.js r128 (CDN)
- **AI NPC**: Anthropic Claude API (`claude-sonnet-4-20250514`, max_tokens 350)
- **배포**: Vercel (정적 파일 서빙)
- **멀티플레이**: PartyKit (WebSocket 실시간 동기화) — 예정
- **DB**: Supabase — 예정 (인벤토리/골드/레벨 영속화)

## 폴더 구조
```
환장/
├── index.html          ← HTML 골격 + script 태그들
├── CLAUDE.md
├── css/
│   └── style.css
├── js/
│   ├── config.js       ← 상수, 아이템/몬스터/NPC 데이터 (의존성 없음)
│   ├── ui.js           ← addChat, 채팅, 데미지 숫자, 토스트
│   ├── inventory.js    ← 인벤토리 상태 + UI + 상점
│   ├── npc.js          ← AI NPC 대화창, askAI, parseHiddenItem
│   ├── player.js       ← PL 객체, 이동, 공격 애니메이션, 레벨
│   ├── monster.js      ← 몬스터 메쉬, AI, 전투
│   ├── world.js        ← Three.js 씬, 맵 빌더, initScene
│   └── main.js         ← 게임 루프, 입력, 닉네임/로딩 화면
└── docs/
    └── GAME_DESIGN.md
```

## 스크립트 로딩 순서 (의존성 순)
index.html에서 순서대로 로드:
1. config.js
2. ui.js
3. inventory.js
4. npc.js
5. player.js
6. monster.js
7. world.js
8. main.js

## 전역 변수 소유권 (어느 파일에서 선언하는가)
| 변수 | 선언 파일 | 참조 파일 |
|------|-----------|-----------|
| `ANTHROPIC_API_KEY` | config.js | npc.js |
| `ITEM_POOL`, `ICON`, `RARITIES`, `ITEM_TYPES` | config.js | inventory.js, npc.js |
| `MONSTER_DEFS`, `NPC_DEF`, `NPC_AI`, `SHOP_STOCK` | config.js | monster.js, world.js, npc.js, inventory.js |
| `inventory`, `gold`, `equipped`, `currentTab`, `selectedItem` | inventory.js | npc.js, player.js, monster.js |
| `invOpen`, `shopOpen` | inventory.js | main.js |
| `activeNpc`, `isAiThinking` | npc.js | main.js |
| `PL`, `playerHP`, `playerMaxHP`, `playerEXP`, `playerLevel` | player.js | monster.js, world.js |
| `attackCooldown`, `invincibleTimer` | player.js | monster.js |
| `monsters`, `closestMonster`, `currentZone` | monster.js | main.js, world.js |
| `scene`, `camera`, `renderer` | world.js | monster.js, player.js |
| `npcs`, `closestNpc` | world.js | main.js |
| `keys`, `cYaw`, `cPitch`, `isDrag`, `lmx`, `lmy` | main.js | player.js (handleMove 실행 시) |
| `myName` | main.js | npc.js, ui.js, inventory.js |

## 코딩 규칙
- 빌드 도구 없음 — ES 모듈(import/export) 사용 금지, 전역 변수로 공유
- 로컬에서 열 때 반드시 로컬 서버 필요 (npx serve . 또는 VS Code Live Server)
- 코드 스타일: 원본 유지 (세미콜론, 축약형 if, 짧은 변수명)
- Three.js r128 API 사용 (최신 버전 아님)

## 멀티플레이 구현 계획 (Phase 2)
1단계 (완료 후 시작):
- PartyKit 서버 (`server/` 폴더)
- 위치 동기화: 100ms 간격 브로드캐스트
- 채팅 동기화: 기존 addChat에 socket emit 추가

2단계:
- Supabase DB 연동 (player 테이블: name, level, hp, gold, inventory JSON)
- 로그인 없이 닉네임으로 식별 (기존 닉네임 시스템 유지)

3단계:
- 몬스터 상태 서버 관리 (PartyKit room state)
- 공동 사냥 시 경험치/드롭 분배

## 주의사항
- ANTHROPIC_API_KEY를 클라이언트에 직접 넣으면 노출됨 → 추후 서버사이드 프록시로 교체 예정
- Vercel serverless function으로 API 키 은닉 처리 예정
