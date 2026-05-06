# NotebookLM MCP Agent

AI 에이전트(Claude Code, Cursor, Codex 등)에서 Google NotebookLM을 활용하여 외부 소스 기반 리서치를 자동화하는 프로젝트입니다.

## 핵심 개념

```
사용자 질문 → AI 에이전트 → MCP 프로토콜 → NotebookLM → 업로드된 소스 기반 응답
```

- **할루시네이션 제거**: NotebookLM은 업로드된 소스만 참조하여 답변합니다
- **토큰 비용 절약**: 에이전트가 PDF를 직접 읽는 대신 NotebookLM에 질문만 전송
- **출처 기반 답변**: 모든 답변에 소스 출처가 포함됩니다

## 프로젝트 구조

```
notebooklm-agent-github/
├── .claude/skills/start/SKILL.md  # /start 슬래시 커맨드 (셋업+시연 마법사)
├── CLAUDE.md                      # 프로젝트 인스트럭션
├── package.json                   # engines + npm scripts
├── clients/                       # MCP 클라이언트 (npx / 디버그 / 로컬)
│   ├── mcp_client.mjs
│   ├── mcp_client_debug.mjs
│   └── mcp_client_local.mjs
├── examples/                      # 사용 예제
│   ├── ask_question.mjs
│   └── multi_notebook_research.mjs
├── scripts/                       # 셋업 & 시연 헬퍼
│   ├── check-env.mjs              # Node 18+/npx 검증
│   ├── setup-auth.mjs             # Google 인증 (브라우저 표시)
│   ├── setup-notebook.mjs         # 노트북 등록
│   ├── select-notebook.mjs        # 기본 노트북 지정
│   ├── health-check.mjs           # 헬스체크 + 노트북 목록
│   ├── ask.mjs                    # 질문 → 파일 저장
│   └── auto-report.mjs            # 6섹션 자동 리포트
├── input/sample_reviews.md        # 시연용 합성 리뷰 데이터
├── output/                        # 산출물 (생성됨)
└── .vscode/mcp.json               # VS Code/Antigravity MCP 설정
```

## 사전 준비

1. **Node.js** 18.0.0 이상
2. **Google 계정** (NotebookLM 접속용 — 자동화 전용 계정 권장)
3. **NotebookLM 노트북** — [notebooklm.google.com](https://notebooklm.google.com)에서 생성

## 빠른 시작 — `/start` (권장)

Claude Code / Antigravity에서 이 폴더를 열고 `/start`를 입력하면
**13단계 마법사**가 한 번에 한 단계씩 안내합니다.

```
/start
```

진행 흐름 (사용자 흐름과 1:1 매칭):
```
A. MCP 설치 (3분)          1. 환경 점검 → 2. npx 캐시 → 3. Google 인증 → 4. 헬스체크
B. 노트북 준비 (4분)        5. 노트북 생성 → 6. PDF 소스 추가 ⭐ → 7. YouTube+산업자료 반자동 큐레이션
C. 에이전트 질문 (5분)     8. 등록 → 9. 기본 지정 → 10. 첫 질문(소스 귀속) → 11. 멀티패스 1→2→3
D. 자동 리포트 (3분)       12. auto-report.mjs → output/market_report.md (6섹션 통합)
E. 마무리                   13. 산출물 정리 + 재활용 안내
```

각 단계에서 `다음`(또는 `next`)을 입력하면 다음 단계로 진행, `처음부터`(`restart`)는 1단계로,
`끝`(`done`)은 종료. 자세한 흐름은 [.claude/skills/start/SKILL.md](.claude/skills/start/SKILL.md) 참조.

## 다른 사용 방식

### 1. Antigravity / VS Code에서 직접 호출

`.vscode/mcp.json`이 이미 포함되어 있으므로, 프로젝트를 열면 NotebookLM MCP가 자동 연결됩니다.

채팅 패널에서 바로 사용:
```
NotebookLM에 물어봐줘: 이 시장의 주요 트렌드 3가지를 정리해줘
```

### 2. CLI에서 사용

```bash
# 서버 상태 확인
node clients/mcp_client.mjs health

# Google 계정 인증 (최초 1회)
node clients/mcp_client.mjs auth

# 노트북 등록
node clients/mcp_client.mjs add "https://notebooklm.google.com/notebook/YOUR_ID" "시장분석" "시장 트렌드 분석" "시장,트렌드"

# 노트북 목록 확인
node clients/mcp_client.mjs list

# 질문하기
node clients/mcp_client.mjs ask "현재 시장의 주요 트렌드는?" "https://notebooklm.google.com/notebook/YOUR_ID"

# 기본 노트북 선택
node clients/mcp_client.mjs select 시장분석
```

### 3. 예제 실행

```bash
# 단일 질문
node examples/ask_question.mjs "핵심 내용을 요약해줘" "https://notebooklm.google.com/notebook/YOUR_ID"

# 멀티 노트북 리서치 (파일 내 NOTEBOOKS 배열 수정 후 실행)
node examples/multi_notebook_research.mjs
```

## NotebookLM MCP 도구 목록

| 카테고리 | 도구 | 설명 |
|---------|------|------|
| **핵심** | `ask_question` | NotebookLM에 질문 → 소스 기반 응답 |
| **노트북 관리** | `add_notebook` | 노트북 등록 |
| | `list_notebooks` | 전체 목록 |
| | `select_notebook` | 기본 노트북 설정 |
| | `search_notebooks` | 검색 |
| | `get_notebook` | 상세 조회 |
| | `update_notebook` | 메타데이터 수정 |
| | `remove_notebook` | 삭제 |
| | `get_library_stats` | 통계 |
| **세션 관리** | `list_sessions` | 활성 세션 목록 |
| | `close_session` | 세션 종료 |
| | `reset_session` | 대화 초기화 |
| **시스템** | `get_health` | 상태 확인 |
| | `setup_auth` | 인증 설정 |
| | `re_auth` | 재인증 |
| | `cleanup_data` | 데이터 정리 |

## 소스 관리 전략

### 노트북 분리 원칙
- 주제별로 노트북을 분리 (시장분석 / 경쟁사분석 / 고객피드백)
- 하나의 노트북에는 하나의 주제만

### 소스 추가 체크포인트
1. **양보다 질** — 관련성 높은 핵심 자료만 엄선
2. **주제 통일** — 다른 주제의 자료를 섞지 않기
3. **출처 확인** — 소스 품질 = 답변 품질

### 업데이트 주기
- **주간**: 새로운 리뷰/뉴스 URL 추가
- **월간**: 오래된 소스 점검 및 제거
- **분기**: 핵심 자료만 추려서 노트북 리빌드

## 멀티패스 리서치 전략

단계적으로 질문하면 더 깊은 분석을 얻을 수 있습니다:

1. **1차 — 전체 개요**: "시장의 주요 트렌드가 뭐야?"
2. **2차 — 세부 분석**: "이 트렌드에서 활용할 수 있는 건?"
3. **3차 — 액션 아이템**: "다음 분기 해야 할 3가지 액션은?"

## 기술 스택

- **MCP 서버**: [notebooklm-mcp](https://www.npmjs.com/package/notebooklm-mcp) (npm)
- **브라우저 자동화**: Patchright (Playwright 기반 스텔스 자동화)
- **프로토콜**: JSON-RPC over stdio
- **런타임**: Node.js 18+

## 참고

- [NotebookLM](https://notebooklm.google.com) — Google AI 리서치 도구
- [notebooklm-mcp GitHub](https://github.com/PleasePrompto/notebooklm-mcp) — MCP 서버 원본 저장소
- [MCP 프로토콜 사양](https://modelcontextprotocol.io) — Model Context Protocol
