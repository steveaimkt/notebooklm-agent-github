---
name: 상세페이지토론
description: 사용자가 "상세페이지 토론하자", "상세페이지 토론 시작", "마케터 디자이너 토론해줘", "와이어프레임 만들어줘" 등으로 요청할 때 트리거. Pain Point + 공감 키워드를 입력받아 마케터·디자이너 두 에이전트가 각각 6섹션 기획안을 산출하고 심판이 채점·하이브리드 통합 → Figma 플러그인 호환 JSON까지 자동 생성한다.
---

# /상세페이지토론 — 마케터 vs 디자이너 토론 → Figma 와이어프레임 JSON 마법사

"상세페이지 토론하자"가 입력되면 사용자가 처음 진입한 것으로 보고 **STEP 0**부터 시작합니다.
이미 진행 중이라면 사용자의 마지막 입력(`다음`, `처음부터`, `끝`)에 따라 분기합니다.

## 진행 규칙 (반드시 준수)

- **한 번의 응답에 한 단계만** 출력. 두 단계를 합쳐서 보내지 않음
- 명령 실행 → 성공 조건 검증 → 실패 시 1회 재시도 → 여전히 실패면 에러를 사용자에게 그대로 보고
- 응답 마지막 줄: ``➡️  다음 단계는 `다음` 또는 `next` 입력``
- `다음`/`next` → 다음 단계, `처음부터`/`restart` → STEP 0, `끝`/`done` → 종료 메시지 후 마법사 종료
- **비유 금지**. "마치 ~처럼", "주방/식당/문" 같은 표현 사용하지 말 것. "토론"은 메타포가 아니라 실제로 두 서브에이전트가 다른 관점에서 산출물을 만드는 것이므로 사용 가능
- 모든 명령은 작업 루트(예: `notebooklm-agent-github/`)에서 실행
- 마케터/디자이너 기획안은 **Task tool로 두 서브에이전트를 병렬 실행**. 한 에이전트가 둘 다 작성하지 않음 (각각의 관점이 섞이면 토론이 무의미)

---

## 실행 환경 전제

이 스킬을 시작하기 전에 다음 중 **하나의 진입 경로**가 충족되어야 한다.

### 경로 A — 후속 모드 (권장)
Part 4 산출물 3개가 `input/` 또는 `output/`에 있을 때. STEP 0-A에서 자동 감지.
- `pain_point_analysis.md` — Pain Point 분석 (Stage 1 대체)
- `empathy_keyword_map.md` — 공감 키워드 맵 (Stage 2 대체)
- `creative_brief.md` — 핵심 메시지 / 페르소나 비중 / 차별화

탐색 순서: `input/` → `output/` → 두 곳 모두 없으면 모드 B로 안내.
강의 시연처럼 **Part 4 폴더에서 새 프로젝트의 `input/`으로 복사**한 케이스가 일반적.

→ Stage 1, 2를 **스킵**하고 Stage 3(마케터)부터 진행. **4단계 모드**.

### 경로 B — 독립 모드
선행 산출물이 없을 때. 사용자가 입력 JSON을 직접 제공.
- `input/{product_slug}_debate_input.json` — `product`, `target`, `selling`, `rawData` 4필드

→ Stage 1(Pain Point 추출)부터 시작. **6단계 모드**.

---

## STEP 0. 시작 시 사용자에게 받을 정보

스킬이 트리거되면 **먼저 다음을 묻고 답을 받은 뒤** 변수에 저장한다. 절대 임의로 가정하지 말고 반드시 묻는다.

```
상세페이지 토론 스킬을 시작합니다. 진행을 위해 아래 정보를 알려주세요.

1. 분석 대상 제품명 (예: 크래프트볼트 20V 8인치 전기톱)
2. Part 4 산출물 파일명 prefix (예: "craftvolt" → 자동으로 craftvolt_reviews.md 등을 탐색)
3. 메인 브랜드 컬러 hex 코드 (예: #FF6B00, 미정이면 "기본"이라고 입력하면 #FF6B00 사용)
4. 진입 모드:
   A) /상세페이지기획 산출물을 활용 (Pain Point + 공감 키워드 재사용)
   B) 독립 실행 (input/{product_slug}_debate_input.json을 직접 제공)
```

**변수 매핑:**
- `{product_name}` — 분석 대상 제품명
- `{product_slug}` — Part 4에서 사용한 파일명 prefix
- `{brand_color}` — 브랜드 메인 컬러 hex (기본값 `#FF6B00`)
- `{mode}` — `A`(후속) 또는 `B`(독립)

---

## STEP 0-A. 작업 루트 + 선행 산출물 자동 검증

STEP 0 답변을 받은 직후 자동 실행. 사용자에게 묻지 않고 결과만 알린다.

### 작업 루트 결정

현재 작업 디렉토리(cwd) 또는 1단계 하위 디렉토리에서 `input/`과 `output/` 폴더 쌍이 함께 있는 곳을 스캔한다.

| 발견 결과 | 처리 |
|---|---|
| **0개** | "현재 폴더에 `input/`, `output/`을 생성할까요?"라고 묻고 답을 기다린다 |
| **1개** | 자동 채택. 예: "✅ 작업 루트: `./notebooklm-agent-github/`" |
| **2개 이상** | 후보 목록을 번호로 보여주고 선택 요청 |

`{work_root}` 변수에 저장.

### 모드별 검증

**모드 A 선택 시:** 다음 파일들을 `input/` → `output/` 순으로 탐색하고, 발견된 경로를 변수에 저장.
- `pain_point_analysis.md` — 필수
- `empathy_keyword_map.md` — 필수
- `creative_brief.md` — 권장

```bash
# 탐색 로직 (의사 코드)
for f in pain_point_analysis.md empathy_keyword_map.md creative_brief.md; do
  if [ -f "{work_root}/input/$f" ]; then
    {brief_dir}=input
  elif [ -f "{work_root}/output/$f" ]; then
    {brief_dir}=output
  fi
done
```

발견 결과를 사용자에게 보고:
- "✅ 선행 산출물 3개 발견 — 위치: `input/`" (또는 `output/`, 또는 혼재 시 파일별 경로)

→ 필수 파일 미존재 시: "선행 산출물이 없습니다. `/상세페이지기획`을 먼저 실행하거나, Part 4 폴더의 3개 파일을 `input/`에 복사하거나, 모드 B로 진행하세요." 출력 후 STEP 0으로 복귀.

**모드 B 선택 시:** `{work_root}/input/{product_slug}_debate_input.json` 존재 확인.

→ 미존재 시: 사용자에게 "JSON 파일을 먼저 만들어 주세요. 형식:

```json
{
  "product": "상품명",
  "target": "타겟 고객 1~2줄",
  "selling": "셀링포인트 / 슬래시로 구분",
  "rawData": "리뷰 텍스트 + 커뮤니티 + 경쟁 비교 + 스펙"
}
```

저장 후 `다음` 입력하세요." 안내.

검증 통과 시 다음 단계로 진행.

---

## 단계별 실행 규칙

1. 각 Stage 종료 후 사용자에게 결과를 요약 제시하고 다음 진행 여부를 묻는다
   - "이 결과로 다음 단계 진행할까요? (`다음` / `다시` / 수정 요청)"
2. 사용자가 "다시"라고 하면 같은 Stage를 재실행한다
3. 사용자가 구체적 수정 요청을 하면 그 부분만 보강해서 재출력한다
4. **사용자 검증이 반드시 필요한 게이트(★)** 에서는 자동 진행하지 말고 명시적 OK를 기다린다

---

# Stage 1. Pain Point 추출 (모드 B에서만 실행)

표시: "1/6 Pain Point 추출 → output/pain_points.json"

**모드 A에서는 이 단계를 스킵하고** `output/pain_point_analysis.md`를 그대로 다음 Stage 입력으로 사용한다고 안내한 뒤 Stage 3으로 점프.

**모드 B 프롬프트:**

```
{work_root}/input/{product_slug}_debate_input.json을 읽고 Pain Point를 추출한다.

역할: 이커머스 고객 리서치 전문가
입력: product / target / selling / rawData

출력 JSON 스키마 (output/pain_points.json):
{
  "pain_points": [
    {
      "id": "P1",
      "category": "기능|품질|가격|배송|AS|사용성|안전|디자인",
      "pain": "Pain Point 요약 (1문장)",
      "severity": "high|medium|low",
      "frequency": "high|medium|low",
      "customer_quotes": ["실제 고객 표현 1", "실제 고객 표현 2"],
      "is_noise": false,
      "noise_reason": ""
    }
  ],
  "category_summary": {
    "기능": 0, "품질": 0, "가격": 0, "배송": 0, "AS": 0, "사용성": 0, "안전": 0, "디자인": 0
  }
}

규칙:
- 단순 불만("별로예요")은 noise로 분류하고 is_noise: true
- 구체적 문제("배터리가 30분도 안 가요")는 진짜 Pain Point
- severity: 구매 포기/반품 수준이면 high, 불편하지만 감수 가능하면 medium, 사소하면 low
- frequency: 3회 이상 반복 언급이면 high, 2회면 medium, 1회면 low
- 최소 5개, 최대 15개 추출
- 한국어
```

**검증 ★:** 유효 Pain Point(`is_noise: false`) 개수 + severity 분포 보고. 5개 미만이면 rawData 부족 경고 후 사용자 결정 확인.

**산출물:** `{work_root}/output/pain_points.json`

---

# Stage 2. 공감 키워드 맵 (모드 B에서만 실행)

표시: "2/6 공감 키워드 맵 → output/keyword_map.json"

**모드 A에서는 이 단계를 스킵**하고 `output/empathy_keyword_map.md`를 사용.

**모드 B 프롬프트:**

```
output/pain_points.json을 입력으로 공감 키워드 맵을 생성한다.

역할: 고객 언어 분석 전문가

출력 JSON 스키마 (output/keyword_map.json):
{
  "keyword_map": [
    {
      "pain_id": "P1",
      "customer_language": "고객이 쓰는 표현",
      "empathy_hook": "공감을 이끄는 헤드라인 (질문형 또는 공감형)",
      "solution_frame": "우리 제품이 해결하는 방식 프레이밍",
      "detail_page_usage": "hero|benefit|social_proof|specs|guarantee|faq",
      "emotional_tone": "frustration|anxiety|desire|curiosity|relief"
    }
  ],
  "top_hooks": ["가장 강력한 공감 헤드라인 1", "공감 헤드라인 2", "공감 헤드라인 3"]
}

규칙:
- customer_language는 customer_quotes에서 직접 뽑은 표현 사용
- empathy_hook은 고객이 "나 얘기다!"라고 느낄 수 있는 문장
- 한국어
```

**산출물:** `{work_root}/output/keyword_map.json`. Top Hooks 3개 미리보기.

---

# Stage 3. 마케터 vs 디자이너 토론 (병렬 실행) ⭐

표시: "3/6 마케터 기획안 + 4/6 디자이너 기획안 (병렬)"

**핵심:** 두 서브에이전트를 **Task tool로 동시에** 호출. 한 메시지에 두 개의 Task 호출을 같이 넣는다 (관점 오염 방지).

## 입력 컨텍스트 준비

모드 A: `output/pain_point_analysis.md` + `output/empathy_keyword_map.md` + `output/creative_brief.md`를 합쳐 `{debate_input}` 변수로 묶음.
모드 B: `output/pain_points.json` + `output/keyword_map.json`을 합쳐 `{debate_input}` 변수로 묶음.

## 마케터 서브에이전트 (Task 호출 1)

```
역할: 전환율 극대화에 집착하는 시니어 퍼포먼스 마케터 (10년차)

입력: {debate_input} + 제품 정보

핵심 원칙:
- 고객의 실제 Pain Point에서 출발 (일반론 금지)
- 공감 키워드를 헤드라인/서브카피에 직접 활용
- AIDA 프레임워크 + 가격 심리학 + 사회적 증거 + 긴급성

반드시 6개 섹션으로 구성:
1. 히어로 (Attention) — 가장 큰 Pain Point 공감 훅 + 즉시 솔루션
2. 문제 공감 (Interest) — 페인포인트 감정적 구체화
3. 솔루션 제시 (Desire 1) — 핵심 셀링포인트 3개 동시 제시
4. 경쟁 비교 (Desire 2) — 경쟁사 대비 구체적 수치 우위
5. 사회적 증거 — 페르소나별 실사용 후기·만족도
6. CTA (Action) — 한정 혜택 + 긴급성으로 즉시 구매 유도

각 섹션마다 명시:
- 섹션명
- 활용할 공감 키워드 (어느 pain_id에서 왔는지)
- 핵심 카피 방향 (메인헤드 + 서브카피)
- 전환율 근거 (왜 이 구성이 효과적인지)

분량: 800자 내외, 한국어. 추상적 표현("좋은 느낌", "깔끔한 디자인") 금지.

산출물: {work_root}/output/marketer_plan.md
```

## 디자이너 서브에이전트 (Task 호출 2)

```
역할: 사용자 경험에 집착하는 시니어 UX/UI 디자이너

입력: {debate_input} + 제품 정보

핵심 원칙:
- 감정 여정 설계: Anxiety → Relief → Confidence → Action
- Pain Point의 감정 톤에 맞는 시각적 톤·배경색 설계
- 고객 언어를 시각적 위계 최상위에 배치
- 모바일 스크롤 흐름: 공감 → 해결 → 확신

반드시 6개 섹션으로 구성:
1. 히어로 — 라이트 그레이(#F8F9FA) 배경 + 절단/사용 장면 + 핵심 인포그래픽
2. 안전 보증 — 연한 그린(#E8F5E8) 배경 + 안전장치 다이어그램·아이콘 그리드
3. 성능 실증 — 따뜻한 옐로(#FFF8E1) 배경 + 기술 성능 시각 증거
4. 배터리/스펙 — 차분한 블루(#E3F2FD) 배경 + 경제적 관점 시각화
5. 가치 제안 — 따뜻한 오렌지(#FFF3E0) 배경 + 풀세트·보증 체크리스트
6. CTA — 브랜드 포인트 컬러({brand_color}) 배경 + 강력한 행동 유도

각 섹션마다 명시:
- 섹션명
- 레이아웃
- 감정 톤 (Anxiety/Relief/Confidence/Action 등)
- 시각적 처리 방법
- 배경색 (hex)

분량: 800자 내외, 한국어.

산출물: {work_root}/output/designer_plan.md
```

**검증 ★:** 두 산출물이 모두 생성됐는지 확인. 각 plan에서 6개 섹션이 모두 정의됐는지 검증. 사용자에게 두 plan의 차이점 1~2줄 요약 제시 후 다음 진행 확인.

**산출물:**
- `{work_root}/output/marketer_plan.md`
- `{work_root}/output/designer_plan.md`

---

# Stage 4. 심판 평가 + 하이브리드 통합

표시: "5/6 심판 채점 + 최종 섹션 결정 → output/judge_result.json"

**프롬프트:**

```
역할: 이커머스 상세페이지 전문 심판관

입력: {debate_input} + marketer_plan.md + designer_plan.md

평가 기준 (각 10점, 총 50점):
1. Pain Point 반영도 — 실제 고객 문제를 다루는가
2. 공감 키워드 활용 — 고객 언어가 사용되었는가
3. 전환 구조 — 구매를 유도하는 흐름인가
4. 감성 설계 — 감정 톤이 적절한가
5. 실행 가능성 — 실제 제작이 현실적인가

규칙: Pain Point가 반영되지 않은 섹션은 감점.

출력 JSON 스키마 (output/judge_result.json):
{
  "marketer_scores": {"pain_reflect":0,"keyword_use":0,"conversion":0,"emotion":0,"feasibility":0},
  "designer_scores": {"pain_reflect":0,"keyword_use":0,"conversion":0,"emotion":0,"feasibility":0},
  "verdict": "평결 2~3문장",
  "final_plan": {
    "sections": [
      {
        "order": 1,
        "name": "섹션명",
        "type": "hero|benefit|proof|specs|cta|guarantee|faq|story|comparison",
        "source": "marketer|designer|hybrid",
        "layout": "full_width|split_50_50|split_60_40|card_grid|sticky_cta|accordion",
        "bg": "#hex",
        "height_vh": 80,
        "headline": "공감 키워드 기반 헤드라인",
        "sub": "서브카피",
        "pain_addressed": "P1",
        "elements": ["요소1", "요소2"],
        "why": "이 섹션을 채택한 근거"
      }
    ]
  }
}

final_plan은 **정확히 6개 섹션** (마케터·디자이너와 같은 구조).
강의 시연 기준 6섹션 매핑:
1. Hero — 마케터의 PP 정면 공격 카피 + 디자이너의 라이트 톤 배경
2. Safety / 안전 보증 — 안전 관련 Pain Point 해결
3. Battery·A/S / 배터리 — 배터리·사후 서비스 차별화
4. Performance / 성능 실증 — 핵심 셀링포인트 시각 증거
5. Value / 가치 제안 — 풀세트·보증·가성비
6. CTA — 시즌 한정 + 긴급성

각 섹션마다 `source: marketer | designer | hybrid`와 `why`(채택 근거)를
반드시 명시. 마케터 섹션 6개와 디자이너 섹션 6개를 그대로 합치지 말고,
순서별로 양쪽 강점을 골라 통합.
```

**검증 ★:** 채점 합계 / 평결 / final_plan 6개 섹션의 source/why를 사용자에게 미리보기.
사용자가 특정 섹션 source 변경을 요청하면 (예: "Hero를 마케터 안으로 바꿔줘"):
- 해당 섹션만 final_plan에서 source 변경 + why 재작성
- 다른 섹션은 그대로 유지
- judge_result.json 부분 갱신 후 사용자 재확인 → Stage 5만 재실행

**산출물:** `{work_root}/output/judge_result.json`

---

# Stage 5. Figma 플러그인 JSON 변환 ⭐ 최종 산출물

표시: "6/6 Figma JSON 변환 → output/{product_slug}_detail_page.json"

**프롬프트:**

```
역할: 이커머스 상세페이지를 Figma 플러그인용 레이아웃 JSON으로 변환하는 전문가

입력: judge_result.json의 final_plan + pain_points + keyword_map + 제품 정보

## 최상위 구조
{
  "type": "CREATE_LAYOUT",
  "version": "3.0",
  "timestamp": "ISO 8601",
  "description": "{product_name} - N섹션 구조 설명",
  "data": {
    "layout": {
      "name": "{product_name}_상세페이지",
      "width": 860,
      "children": [ ... 섹션 배열 ... ]
    }
  }
}

## 섹션 구조
{
  "name": "Section_NN_Name",
  "type": "SECTION",
  "height": 800~1800,
  "background": "#hex",
  "children": [ TEXT, IMAGE_AREA, BUTTON ]
}

## 자식 요소 3종

### TEXT
{"type":"TEXT","name":"...","content":"...","fontSize":N,"fontWeight":400|500|600|700,"color":"#hex","textAlign":"CENTER|LEFT"}

텍스트 위계:
- 브랜드명: 22 / 500 / {brand_color}
- 메인카피: 36~56 / 700 / #FFFFFF
- 서브카피: 26~32 / 500 / {brand_color} or #FFFFFF
- 설명문: 22 / 400 / #888888
- 강조: 24~26 / 600 / {brand_color}
- 스펙 하이라이트: 24 / 600 / #FFD700
- 여러 줄: \n 사용. 긴 텍스트는 "width": 760 추가

### IMAGE_AREA
{"type":"IMAGE_AREA","name":"IMAGE_AREA","width":760,"height":300~600,"background":"#2A2A2A","label":"촬영/제작 가이드 — 구체적 이미지 설명"}

### BUTTON
{"type":"BUTTON","text":"...","background":"{brand_color}","color":"#FFFFFF","width":320,"height":70,"fontSize":28,"fontWeight":700}

## 디자인 규칙
- 전체 너비 860px / 콘텐츠 760px
- 다크 배경 교차: #111111 / #1A1A1A
- 포인트 배경: {brand_color} (히어로/솔루션/추천/보증/CTA)
- 차별화 배경: #FFD700 (국내 최초 등 USP 섹션)
- 이미지 플레이스홀더: #2A2A2A
- 섹션 네이밍: Section_01_Hook, Section_02_WhatIsThis, ...

## 카피라이팅 원칙
- 질문형 헤드라인 ("왜 OOO인가요?", "OOO가 뭔가요?")
- 공감 → 해결 구조 (체크리스트 → 해결 선언)
- 고객 실제 표현을 카피에 직접 활용
- 전문 용어는 쉬운 말로 풀어서

## 중요
- 순수 JSON만 출력, 마크다운 코드 블록 없이
- final_plan의 모든 섹션을 빠짐없이 변환
- IMAGE_AREA의 label은 촬영/디자인 가이드로 활용 가능하게 구체적으로
- 한국어
```

**검증 ★:** 생성된 JSON을 Read해서 다음을 검증.
- `data.layout.children` 배열 길이 = 6 (final_plan과 동일)
- 각 섹션의 `children`에 TEXT/IMAGE_AREA/BUTTON 요소가 1개 이상
- 첫 섹션이 `Section_01_Hero`로 시작 / 마지막이 `Section_06_CTA` 패턴인지
- 각 IMAGE_AREA의 `label`에 촬영 가이드 문장이 들어 있는지 (≥ 10자)

검증 실패 시 1회 재시도. 그래도 실패면 사용자에게 raw 결과 보여주고 수동 보정 안내.

**산출물:** `{work_root}/output/{product_slug}_detail_page.json`

추가 저장:
- `{work_root}/output/{product_slug}_debate_full.json` — 전체 토론 기록 (입력/painData/keywordMap/marketerPlan/designerPlan/judgeData/timestamp)

---

# 마무리

## 종료 메시지

다음 형식으로 출력:

```
✅ 상세페이지 토론 → 와이어프레임 생성 완료

📥 입력 (재사용 또는 신규)
  · output/pain_point_analysis.md (또는 output/pain_points.json)
  · output/empathy_keyword_map.md (또는 output/keyword_map.json)

🤖 토론 산출물
  · output/marketer_plan.md          (마케터 6섹션 기획안)
  · output/designer_plan.md          (디자이너 6섹션 기획안)
  · output/judge_result.json         (채점 + 하이브리드 final_plan)

📤 최종 산출물
  · output/{product_slug}_detail_page.json    ★ Figma 플러그인 입력
  · output/{product_slug}_debate_full.json    (전체 토론 기록)

📊 채점 결과: 마케터 {mTotal}/50 | 디자이너 {dTotal}/50
📐 최종 섹션: {section_count}개

다음 단계: Figma 플러그인에서 detail_page.json 로드 → 와이어프레임 자동 생성
"전환율 극대화"와 "감정 여정 설계" 두 관점이 부딪힐수록 더 좋은 페이지가 나옵니다.

🔁 재실행 옵션
  · 입력 파일을 수정한 뒤 "다시 실행해줘"      → STEP 0 변수 재사용, Stage 3부터 재실행
  · "Hero를 마케터 안으로 바꿔줘"               → judge_result.json 부분 수정 + Stage 5 재실행
  · "처음부터" 또는 "상세페이지 토론하자"         → STEP 0부터 새로 시작

📊 결과 분석 요청 예시 (스킬 종료 후 일반 채팅)
  · "방금 생성된 Figma JSON을 섹션별로 표로 정리해줘"
  · "배경색·메인 카피·Pain Point 연결까지 보여줘"
```

마법사 종료.

## 종료 후 후속 인터랙션 핸들링

스킬이 마무리된 직후 사용자가 다음 패턴으로 입력하면 처리한다.

| 사용자 입력 | 처리 |
|---|---|
| `다시 실행해줘` (input 수정 후) | STEP 0 변수(`{product_name}`, `{product_slug}`, `{brand_color}`, `{mode}`)를 재사용하고 STEP 0-A부터 자동 재실행. 변수 재질문 X. |
| `{N번} 섹션을 {marketer\|designer} 안으로 바꿔줘` | judge_result.json만 부분 수정 후 Stage 5(Figma JSON)만 재실행. Stage 1~4는 건드리지 않음. |
| `creative_brief.md의 페르소나 비중을 박정훈 50%로 바꿔줘` | input 파일을 직접 Edit하고 사용자에게 "수정 완료. `다시 실행해줘`라고 입력하면 재실행합니다" 안내. |
| `Figma JSON을 표로 정리해줘` | 스킬 외부 일반 채팅. detail_page.json을 Read해서 표로 출력. 재실행 아님. |

---

# 에러 / 예외 처리

| 상황 | 처리 |
|---|---|
| 모드 A 선택했는데 선행 산출물 없음 | "/상세페이지기획 먼저 실행하거나 모드 B로" 안내 후 STEP 0 복귀 |
| 모드 B인데 input JSON 없음 | JSON 형식 안내 + 파일 생성 후 `다음` 입력 대기 |
| Stage 1 유효 Pain Point 5개 미만 | rawData 부족 경고, 사용자 결정 확인 |
| Task tool 병렬 실행 실패 | 1회 재시도, 그래도 실패면 순차 실행으로 폴백 |
| Stage 4/5 JSON 파싱 실패 | 1회 재시도, 그래도 실패면 raw 출력 + 수동 보정 안내 |
| 사용자 "다시" 요청 | 직전 Stage만 재실행, 이전 산출물 유지 |
| 사용자가 색상 등 수정 요청 | Stage 5만 재실행 |

---

# 스킬 안에서 절대 하지 말 것

- 변수(`{product_name}`, `{brand_color}` 등)를 묻지 않고 임의 가정
- 마케터/디자이너 기획안을 한 에이전트가 둘 다 작성 (관점 오염 → 토론 무의미)
- 사용자 검증 게이트(★)를 건너뛰고 자동 진행
- Pain Point가 반영되지 않은 섹션을 final_plan에 그대로 통과시키기
- final_plan의 섹션 일부만 Figma JSON으로 변환하기 (반드시 전체 변환)
- "비유"로 단계를 설명 ("마치 ~처럼" 금지). "토론"은 실제 두 에이전트가 작동하는 행위이므로 사용 가능
