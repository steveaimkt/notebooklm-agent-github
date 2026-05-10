---
name: 상세페이지디자인
description: 사용자가 "상세페이지 디자인하자", "상세페이지 디자인 시작", "피그마 플러그인 실행", "Figma에 적용해줘" 등으로 요청할 때 트리거. /상세페이지토론이 만든 {slug}_detail_page.json을 Figma 데스크톱 플러그인 "Detail Page Layout Generator"로 30초 만에 와이어프레임으로 변환하고, 자연어 수정 / 페르소나별 시안 변형까지 한 단계씩 안내한다.
---

# /상세페이지디자인 — Figma 플러그인 셋업 + 와이어프레임 적용 + 시안 변형 마법사

"상세페이지 디자인하자"가 입력되면 사용자가 처음 진입한 것으로 보고 **STEP 0**부터 시작합니다.
이미 진행 중이라면 사용자의 마지막 입력(`다음`, `처음부터`, `끝`, `건너뛰기`)에 따라 분기합니다.

## 진행 규칙 (반드시 준수)

- **한 번의 응답에 한 단계만** 출력. 두 단계를 합쳐서 보내지 않음
- 명령은 Bash 도구로 실행 → 성공 조건 검증 → 실패 시 1회 재시도 → 여전히 실패면 에러를 사용자에게 그대로 보고
- 응답 마지막 줄: ``➡️  다음 단계는 `다음` 또는 `next` 입력``
- `다음`/`next` → 다음 단계, `처음부터`/`restart` → STEP 0, `끝`/`done` → 종료, `건너뛰기`/`skip` → 선택 단계 스킵
- **비유 금지**: "마치 ~처럼", "주방/식당/문" 같은 표현 사용하지 말 것. 기술적 사실만 서술
- 모든 명령은 작업 루트(`notebooklm-agent-github/`)에서 실행
- **Figma 플러그인 등록·적용은 사용자가 Figma 데스크톱 앱에서 직접 수행**. 마법사는 안내만 제공하고 명령을 실행하지 않음

---

## 실행 환경 전제

이 스킬을 시작하기 전에 다음이 충족되어야 한다.

| 필요 | 확인 방법 |
|---|---|
| `output/{slug}_detail_page.json` 존재 | STEP 0-A에서 자동 검증 |
| **Figma 데스크톱 앱** 설치 (웹 X) | 사용자에게 명시적으로 묻고 확인 |
| Antigravity / Claude Code에서 본 폴더 오픈 | 이미 충족 (스킬이 트리거된 시점) |
| `figma-plugin/manifest.json` 존재 | 본 저장소에 포함 |

`{slug}_detail_page.json`이 없으면 `/상세페이지토론`을 먼저 실행하라고 안내하고 종료한다.

---

## STEP 0. 시작 시 사용자에게 받을 정보

스킬이 트리거되면 **먼저 다음을 묻고 답을 받은 뒤** 변수에 저장한다. 절대 임의로 가정하지 말고 반드시 묻는다.

```
상세페이지 디자인 스킬을 시작합니다. /상세페이지토론에서 만든 JSON을
Figma 플러그인으로 30초 만에 와이어프레임으로 변환합니다.

진행을 위해 아래 정보를 알려주세요.

1. 대상 JSON 파일명 prefix (예: "craftvolt" → output/craftvolt_detail_page.json)
   기본값: craftvolt
2. Figma 데스크톱 앱이 설치되어 있나요? (예 / 아니오)
   ※ 웹 버전은 Plugin 등록이 안 됩니다. 반드시 데스크톱 앱이어야 합니다.
3. 카피 보강 단계(STEP 3)를 진행할까요? (예 / 아니오 / 나중에)
   - "예": creative_brief.md / pain_point_analysis.md를 활용해 텍스트만 다듬음
   - "아니오": JSON 그대로 Figma에 적용
```

**변수 매핑:**
- `{slug}` — 대상 JSON 파일명 prefix (기본 `craftvolt`)
- `{detail_json}` — `output/{slug}_detail_page.json`
- `{has_figma_desktop}` — `예`/`아니오`
- `{do_copy_boost}` — `예`/`아니오`/`나중에`

`{has_figma_desktop}`이 "아니오"면: https://www.figma.com/downloads/ 에서 데스크톱 앱 설치 → 로그인 후 `다음` 입력하라고 안내하고 STEP 0에서 대기.

---

## STEP 0-A. 입력 파일 자동 검증

STEP 0 답변 직후 자동 실행. 사용자에게 묻지 않고 결과만 알린다.

다음 파일 존재 여부 확인:
- `{detail_json}` — 필수
- `figma-plugin/manifest.json` — 필수
- `output/creative_brief.md` — STEP 3 진행 시 필수
- `output/pain_point_analysis.md` — STEP 3 진행 시 필수

검증 결과를 사용자에게 보고:
```
✅ output/{slug}_detail_page.json — 6섹션, version 3.0
✅ figma-plugin/manifest.json — Detail Page Layout Generator
{STEP 3 진행 시}
✅ output/creative_brief.md
✅ output/pain_point_analysis.md
```

`{detail_json}` 미존재 시:
```
❌ output/{slug}_detail_page.json이 없습니다.

먼저 /상세페이지토론을 실행해서 JSON을 생성하거나,
다른 prefix를 사용한다면 STEP 0으로 돌아가서 prefix를 정정해주세요.
```
출력 후 STEP 0 복귀.

검증 통과 시 다음 단계로 진행.

---

# STEP 1. 프로젝트 준비 — Figma 플러그인 등록 (약 1분 30초)

표시: "1/5 Figma 데스크톱에 플러그인 등록"

**자동 수행 (Bash):**

`figma-plugin/manifest.json`의 절대경로를 출력해서 사용자가 바로 클립보드에 복사할 수 있게 한다.

```bash
realpath figma-plugin/manifest.json
```

**사용자 안내 (그대로 출력):**

```
🔹 Antigravity / Claude Code 측은 이미 준비됨
   본 폴더가 열려 있어서 CLAUDE.md(섹션 구조·색상·타이포·JSON 스키마)는
   자동 로드된 상태입니다. 별도 설명 없이도 일관된 결과가 유지됩니다.

🔹 Figma 데스크톱 앱에서 플러그인 등록 (1회만)
   1. Figma 데스크톱 앱 실행 → 아무 파일이나 열기
   2. 상단 메뉴: Plugins → Development → Import plugin from manifest...
   3. 아래 경로의 manifest.json 선택:
      {realpath 결과}
   4. "열기" 클릭

✅ 확인: Plugins → Development 메뉴에 "Detail Page Layout Generator"가 보이면 성공

⚠️ 주의
   - 반드시 Figma 데스크톱 앱(웹 X)
   - 이미 등록되어 있으면 이 단계는 스킵해도 됩니다 ("다음" 입력)
```

검증: 사용자가 "다음"이라고 입력하면 등록 완료로 간주하고 진행.

---

# STEP 2. {slug}_detail_page.json 구조 살펴보기 (약 2분)

표시: "2/5 입력 JSON 구조 확인"

**자동 수행 (Read + Bash):**

`{detail_json}`을 읽어서 다음을 사용자에게 표로 출력:

```bash
python3 -c "
import json, os
d = json.load(open('output/{slug}_detail_page.json'))
print('type:', d['type'])
print('version:', d['version'])
print('width:', d['data']['layout']['width'])
print('---')
for i, s in enumerate(d['data']['layout']['children'], 1):
    text_n = sum(1 for c in s.get('children',[]) if c.get('type')=='TEXT')
    img_n  = sum(1 for c in s.get('children',[]) if c.get('type')=='IMAGE_AREA')
    btn_n  = sum(1 for c in s.get('children',[]) if c.get('type')=='BUTTON')
    print(f'{i:02d}. {s[\"name\"]:24s}  TEXT:{text_n}  IMAGE:{img_n}  BUTTON:{btn_n}')
"
```

**사용자에게 출력할 내용:**

```
📋 {slug}_detail_page.json 요약
type: CREATE_LAYOUT
version: 3.0
canvas width: 860px

섹션 6개:
01. Section_01_Hero        TEXT:?  IMAGE:?  BUTTON:?
02. Section_02_Safety      TEXT:?  IMAGE:?  BUTTON:?
03. Section_03_BatteryAS   TEXT:?  IMAGE:?  BUTTON:?
04. Section_04_Performance TEXT:?  IMAGE:?  BUTTON:?
05. Section_05_Value       TEXT:?  IMAGE:?  BUTTON:?
06. Section_06_CTA         TEXT:?  IMAGE:?  BUTTON:?

핵심 포인트
- type: "CREATE_LAYOUT" — 플러그인이 읽는 시그널
- 모든 섹션은 SECTION 타입, 자식은 TEXT / IMAGE_AREA / BUTTON 3종
- 카피·폰트·컬러·이미지 영역까지 명세 완료. 사용자가 직접 만들 게 없음
- /상세페이지토론 에이전트가 채워둔 결과
```

`{do_copy_boost}`가 "예"면 STEP 3로, "아니오"·"나중에"면 STEP 4로 점프 안내.

---

# STEP 3. (선택) 카피 보강 — 공감 키워드로 텍스트만 다듬기 (약 3분)

표시: "3/5 카피 보강 — TEXT content만 보강 (구조·디자인 고정)"

이 단계는 `{do_copy_boost}`가 "예"일 때만 실행. "아니오"·"나중에"·"건너뛰기"이면 STEP 4로 즉시 진행.

**사용자 안내 (그대로 출력):**

```
이 단계는 6섹션 구조와 fontSize / color / IMAGE_AREA는 그대로 두고,
각 섹션의 TEXT content만 /상세페이지기획의 산출물로 다듬습니다.

입력 파일:
  · {detail_json}
  · output/creative_brief.md (§8 공감 키워드 12개)
  · output/pain_point_analysis.md (리뷰 인용)

원칙: "구조와 디자인은 고정, 텍스트만 보강"
이 원칙을 명시하지 않으면 카피와 함께 디자인까지 수정되어 일관성이 깨집니다.
```

**자동 수행:**

다음 프롬프트로 Edit 도구를 사용해 `{detail_json}`의 TEXT content만 보강:

```
{detail_json}의 6섹션 구조는 그대로 유지하고,
각 섹션의 TEXT content만 output/creative_brief.md §8 공감 키워드 12개와
output/pain_point_analysis.md의 리뷰 인용을 활용해 다듬는다.

규칙:
- fontSize, fontWeight, color, textAlign, width 변경 금지
- IMAGE_AREA 변경 금지 (label 포함)
- BUTTON 변경 금지
- SECTION의 background, height 변경 금지
- 각 섹션의 children 배열 길이 변경 금지
- 변경 가능: TEXT 요소의 content 필드만

저장: 같은 경로 {detail_json}에 덮어쓰기
백업: output/{slug}_detail_page.before_boost.json (Before 비교용)
```

**검증 ★:**
- 변경 전·후 fontSize·color·IMAGE_AREA 합계가 동일한지 확인
- 사용자에게 Hero / BatteryAS 섹션의 Before / After 카피 1개씩만 비교 출력
- "더 다듬을 부분 있나요? (`다음` / 수정 요청)" 확인

---

# STEP 4. ⭐ Figma에 적용 (약 4분)

표시: "4/5 Figma 데스크톱 앱에서 플러그인 실행 — 메인 이벤트"

**자동 수행 (Bash):**

JSON을 클립보드에 자동 복사 (macOS):

```bash
cat output/{slug}_detail_page.json | pbcopy && echo "✅ 클립보드에 복사 완료"
```

실패 시 사용자에게 수동 복사 안내 (`Cmd+A` → `Cmd+C`).

**사용자 안내 (그대로 출력):**

```
🔹 Figma 데스크톱 앱에서 다음을 수행하세요

  1. 새 디자인 파일 생성 (또는 기존 파일 열기)
  2. 메뉴: Plugins → Development → Detail Page Layout Generator
  3. 플러그인 창의 텍스트 영역에 붙여넣기 (Cmd+V)
     ※ 이미 클립보드에 JSON이 복사되어 있습니다
  4. "생성" 버튼 클릭

✅ 결과: 860px 너비의 6섹션 와이어프레임이 자동 생성됩니다
   01 Hero / 02 Safety / 03 BatteryAS / 04 Performance / 05 Value / 06 CTA

🔧 생성 후 편집
   - 텍스트: 더블클릭으로 직접 수정
   - 이미지: 회색 IMAGE_AREA 선택 → 우측 Fill → Image → Choose Image
            (또는 사진 파일을 IMAGE_AREA 위로 드래그 앤 드롭)
   - 색상: 요소 선택 → 우측 Fill 색상 클릭 → 새 hex 입력

❌ 에러가 나면
   대부분 JSON 포맷 문제입니다. 맨 앞·맨 뒤 중괄호({, })가 누락됐을 수 있어요.
   "다시 복사"라고 입력하면 클립보드에 다시 복사합니다.
```

`다시 복사` 입력 시: 위 pbcopy 명령을 재실행하고 사용자에게 다시 시도 안내.

검증: 사용자가 "다음"이라고 입력하면 적용 완료로 간주.

---

# STEP 5. 자연어 수정 + 페르소나별 시안 변형 (약 3분 30초)

표시: "5/5 자연어로 JSON 수정 → 플러그인 재실행 → 시안 비교"

이 단계의 핵심: **JSON을 클로드한테 자연어로 수정 요청 → 클립보드 자동 복사 → 사용자가 플러그인에 다시 붙여넣기**.
한 사이클당 30초~1분. 시안 3~4개를 5분 안에 비교 가능.

**사용자에게 다음 메뉴 출력:**

```
원하는 작업을 골라주세요. 사용자가 자연어로 요청하면 JSON을 수정하고
클립보드에 다시 복사합니다. 그 후 Figma 플러그인에서 다시 생성하면 됩니다.

🔧 1차 수정 예시 (구조·컬러·폰트)
   "Safety 섹션을 BatteryAS 뒤로 옮기고,
    브랜드 컬러를 #FF6B00로 통일,
    Performance 섹션 헤드라인 폰트 52→60"

🎨 2차 변형 — 페르소나 시안
   "같은 6섹션을 30대 여성(김지영) 톤으로 다시 다듬어줘.
    부드러운 컬러 팔레트로."

   "이번엔 50대 남성(박정훈) 톤, 진중한 컬러로."

💡 자유 입력
   직접 수정 요청을 적어주세요. 예: "CTA 버튼 텍스트를 더 강하게"

입력하면 JSON을 수정하고 자동으로 클립보드 복사까지 해드립니다.
완료되면 "끝" 입력.
```

**사용자 입력 처리 루프:**

각 수정 요청마다 다음을 반복 (사용자가 `끝`/`done` 입력 전까지):

1. 현재 `{detail_json}` Read
2. Edit 도구로 사용자 요청 반영 (구조·디자인·텍스트 자유롭게 수정 가능. STEP 3과 달리 제약 없음)
3. 페르소나 시안인 경우: 별도 파일로 저장
   - 김지영 톤: `output/{slug}_detail_page.kim.json`
   - 박정훈 톤: `output/{slug}_detail_page.park.json`
   - 1차 일반 수정: `{detail_json}`에 덮어쓰기
4. `pbcopy`로 클립보드 복사
5. 사용자에게:
   ```
   ✅ 수정 완료 → 클립보드에 복사됨
   📂 저장 위치: {파일 경로}

   Figma에서 Plugins → Development → Detail Page Layout Generator
   다시 실행하고 새 JSON을 붙여넣으면 변경된 레이아웃이 그려집니다.

   계속 수정하려면 다음 요청 입력, 마치려면 `끝`.
   ```

`끝`/`done` 입력 시 마무리로 진입.

---

# 마무리

## 종료 메시지

다음 형식으로 출력:

```
✅ 상세페이지 디자인 적용 완료

📥 입력
  · output/{slug}_detail_page.json (/상세페이지토론 산출물)

📤 추가 산출물 (있을 때만 표시)
  · output/{slug}_detail_page.before_boost.json   (STEP 3 보강 전 백업)
  · output/{slug}_detail_page.kim.json            (김지영 페르소나 시안)
  · output/{slug}_detail_page.park.json           (박정훈 페르소나 시안)

🎨 Figma 결과
  · 860px 6섹션 와이어프레임 1개 + 시안 변형 N개
  · 텍스트는 더블클릭 편집, IMAGE_AREA는 드래그 앤 드롭으로 사진 교체

🔁 재실행 옵션
  · "다시 복사"               → 가장 최근 JSON을 클립보드에 다시 복사
  · "{슬러그} 시안 추가해줘"  → 새 페르소나 시안 1개 더
  · "처음부터" / "상세페이지 디자인하자" → STEP 0부터 새로 시작

📌 파이프라인 위치
  /시장조사 → /상세페이지기획 → /상세페이지토론 → /상세페이지디자인 (현재 완료)
  같은 JSON 스키마로 모든 단계가 연결되어 있어서, 디자이너가 3~5일 걸릴 작업이
  사람 손 거의 없이 30초로 끝납니다.
```

마법사 종료.

## 종료 후 후속 인터랙션 핸들링

| 사용자 입력 | 처리 |
|---|---|
| `다시 복사` | 가장 최근 작성된 `*.json`을 `pbcopy`로 다시 복사. 재실행 아님. |
| `{slug} 시안 추가해줘 — 30대 남성 미니멀` | STEP 5 루프만 1회 실행. 변형 파일 1개 추가 후 클립보드 복사. |
| `IMAGE_AREA 라벨을 표로 정리해줘` | 스킬 외부 일반 채팅. JSON Read해서 표 출력. |
| `구조 그대로 영문 버전 만들어줘` | STEP 5 루프 1회 실행. `{slug}_detail_page.en.json` 저장. |

---

# 에러 / 예외 처리

| 상황 | 처리 |
|---|---|
| `{detail_json}` 미존재 | `/상세페이지토론` 먼저 실행 안내 후 종료 |
| Figma 데스크톱 미설치 | 다운로드 URL 안내 후 STEP 0 대기 |
| `pbcopy` 실패 (Linux 등) | `xclip -selection clipboard` 폴백, 그래도 실패면 수동 복사 안내 |
| STEP 3 검증에서 fontSize/color 변경이 감지됨 | 1회 재시도, 그래도 실패면 백업 파일에서 복원 후 사용자에게 보고 |
| 플러그인 적용 시 사용자가 "에러" 보고 | 자동으로 JSON 첫 4자 / 마지막 4자를 출력해서 중괄호 누락 여부 확인 |

---

# 스킬 안에서 절대 하지 말 것

- 변수(`{slug}`, `{has_figma_desktop}`, `{do_copy_boost}`)를 묻지 않고 임의 가정
- STEP 3에서 fontSize·color·IMAGE_AREA·BUTTON·SECTION background를 변경 (텍스트만 보강 원칙 위반)
- Figma 플러그인 등록·적용을 마법사가 직접 시도 (사용자가 데스크톱 앱에서 수행)
- "비유"로 단계를 설명 ("마치 ~처럼" 금지)
- 사용자 검증 게이트(★)를 건너뛰고 자동 진행
- `figma-plugin/code.js` 또는 `manifest.json`을 임의로 수정 (별도 요청 시에만)
