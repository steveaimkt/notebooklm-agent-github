# CLAUDE.md

이 저장소는 NotebookLM MCP 서버를 활용하는 AI 에이전트 클라이언트 모음입니다.
사용자는 `/start` 슬래시 커맨드로 설치부터 시연까지 마법사 모드를 진행할 수 있습니다.

## Project Overview

```
notebooklm-agent-github/
├── clients/        MCP 클라이언트 3종 (npx 기반 / 디버그 / 로컬 빌드)
├── examples/       단일 질문 / 멀티 노트북 리서치 예제
├── scripts/        셋업 마법사 헬퍼 (env 검증, 인증, 노트북 등록, 헬스체크, ask)
├── input/          분석 대상 데이터 (샘플 리뷰 포함)
├── output/         분석 결과 산출물 (detail_page.json 포함)
├── figma-plugin/   Figma 데스크톱 플러그인 (manifest.json / code.js / ui.html)
├── templates/      24섹션 표준 구조 템플릿 (detail-page-structure.json)
├── 크래프트볼트/    24섹션 기준 레퍼런스 (craftvolt-chainsaw-v3-final.json)
└── .claude/skills/  슬래시 커맨드 정의 (start / 시장조사 / 상세페이지기획 / 상세페이지토론 / 상세페이지디자인)
```

핵심 흐름: `npx -y notebooklm-mcp@latest`로 MCP 서버를 spawn → JSON-RPC over stdio
(protocolVersion `2024-11-05`)로 통신 → NotebookLM 웹을 Patchright로 자동화하여
업로드된 소스 기반의 답변을 받음.

## "/start" 마법사 모드

`/start`(또는 `시작`)이 입력되면 `.claude/skills/start/SKILL.md`의 흐름을
1단계부터 한 단계씩 진행합니다.

### 진행 규칙
- 한 번의 응답에 **한 단계만** 출력. 마지막 줄에 `다음 단계는 \`다음\` 또는 \`next\` 입력` 표기
- `다음`/`next` → 다음 단계, `처음부터`/`restart` → 1단계, `끝`/`done` → 종료
- 명령 실행 → 성공 조건 확인 → 실패 시 1회 재시도 → 그래도 실패하면 사용자에게 에러 보고
- **비유 금지**: "마치 ~처럼", "식당/주방/문" 같은 비유 표현 X. 기술적 사실만 서술

## 도구 사용 컨벤션

- 모든 npx 실행은 `npx -y notebooklm-mcp@latest`로 통일
- Node 18+ 필수 (`engines` 명시)
- 환경 변수는 `.env`로 관리, 절대 커밋 금지
- 산출물은 `output/`, 입력은 `input/` 아래에 위치
- 브라우저 상태(쿠키/세션)는 `~/Library/Application Support/notebooklm-mcp/chrome_profile`에 저장됨 (gitignore 처리됨)

## 시연 컨텍스트

시연 데이터는 가상 브랜드 **크래프트볼트(CRAFT VOLT, 18V 무선 임팩트 드릴)** 기준입니다.
사용자는 NotebookLM에 자신의 PDF/소스를 등록한 상태에서 `/start`를 진행하며,
산출물 4개(키워드/페르소나/리포트/브리프)가 `output/`에 생성됩니다.

## 파이프라인 흐름 (시장조사 → 디자인)

```
/시장조사       → review_keywords / target_personas / market_report / research_brief
/상세페이지기획 → pain_point_analysis.md / empathy_keyword_map.md / creative_brief.md
/상세페이지토론 → marketer_plan.md / designer_plan.md / judge_result.json
                  + {slug}_detail_page.json  (Figma 플러그인 입력)
/상세페이지디자인 → Figma 데스크톱 플러그인으로 와이어프레임 자동 생성 + 자연어 시안 변형
```

`{slug}_detail_page.json` 한 파일이 `/상세페이지토론`과 `/상세페이지디자인`을 잇는 인터페이스다.
스키마 변경 시 두 스킬과 `figma-plugin/code.js`를 함께 검토해야 한다.
