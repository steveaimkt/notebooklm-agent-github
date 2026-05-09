---
name: 상세페이지기획
description: 사용자가 "상세페이지 기획하자"라고 입력하면 트리거. 경쟁사 캡처 → 유튜브 웹서치 → 클로드 자율 보강 → NotebookLM 등록 → Pain Point 분석 → 공감 키워드 맵 → Creative Brief까지 7단계 파이프라인을 한 단계씩 안내하며, 각 단계마다 사용자가 `다음`을 입력해야 다음으로 넘어간다.
---

# /상세페이지기획 — 쿠팡 상세페이지용 Creative Brief 생성 마법사

"상세페이지 기획하자"가 입력되면 사용자가 처음 진입한 것으로 보고 **1단계**부터 시작합니다.
이미 진행 중이라면 사용자의 마지막 입력(`다음`, `처음부터`, `끝`)에 따라 분기합니다.

## 진행 규칙 (반드시 준수)

- **한 번의 응답에 한 단계만** 출력. 두 단계를 합쳐서 보내지 않음
- 명령 실행 → 성공 조건 검증 → 실패 시 1회 재시도 → 여전히 실패면 에러를 사용자에게 그대로 보고
- 응답 마지막 줄: ``➡️  다음 단계는 `다음` 또는 `next` 입력``
- `다음`/`next` → 다음 단계, `처음부터`/`restart` → 1단계, `끝`/`done` → 종료 메시지 후 마법사 종료
- **비유 금지**. "마치 ~처럼", "주방/식당/문" 같은 표현 사용하지 말 것
- 모든 명령은 저장소 루트(`notebooklm-agent-github/`)에서 실행
- 1~3단계는 **사용자가 직접 캡처/입력**, 4단계는 **NotebookLM 웹에서 직접 등록**. 마법사는 안내·검증만 수행

---

## 실행 환경 전제

이 스킬을 시작하기 전에 다음이 갖춰져 있어야 한다. 갖춰지지 않은 경우 사용자에게 알리고 진행 가능 여부를 확인한다.

- Part 4(시장조사) 산출물 5종이 `output/`에 존재 — 필수
  - `output/review_keywords_analysis.md`
  - `output/target_personas.md`
  - `output/market_analysis_report.md`
  - `output/research_brief.md`
  - `input/{product_slug}_reviews.md` (예: `input/craftvolt_reviews.md`)
- NotebookLM MCP 연동 (Part 4 클립1 완료) — 필수 (5단계 Pain Point 심층 질문에 사용)

전제 미충족 시: "Part 4 시장조사 산출물이 먼저 필요합니다. `/시장조사` 또는 `/start`를 먼저 실행하세요."

---

## STEP 0. 시작 시 사용자에게 받을 정보

스킬이 트리거되면 **먼저 다음을 한 번에 묻고 답을 받은 뒤** 변수에 저장한다. 절대 임의로 가정하지 말고 반드시 묻는다.

```
상세페이지 기획 스킬을 시작합니다. 진행을 위해 아래 정보를 알려주세요.

1. 분석 대상 제품명 (예: 크래프트볼트 21V 무선 미니 전기톱)
2. 카테고리 / 검색 키워드 (예: 무선 미니 전기톱)
3. NotebookLM 노트북 이름 (Part 4에서 사용한 노트북)
4. Part 4 산출물 파일명 prefix (예: "craftvolt" → craftvolt_reviews.md)
```

**변수 매핑:**
- `{product_name}` — 분석 대상 제품명
- `{product_category}` — 카테고리/검색 키워드
- `{notebooklm_notebook}` — NotebookLM 노트북 이름
- `{product_slug}` — Part 4에서 사용한 파일명 prefix

답변 후 `output/` 디렉토리에서 5종 파일 존재 여부를 검증하고, 없으면 사용자에게 보고한다.

---

## A. 입력 자료 보강 (1~3) — 약 8분

### 1단계: 경쟁사 캡처 → MD 변환
표시: "1/7 경쟁사 상세페이지 캡처 → input/competitor_detail_pages.md"

사용자에게 다음을 그대로 출력:

```
🔹 캡처 작업 (사용자 직접)
  1. 쿠팡 / 네이버 / 자사몰에서 경쟁사 상세페이지 2~3개 열기
  2. 영역별 5~6장씩 캡처 (총 10~15장)
     - 메인 비주얼 / 옵션 / 스펙표 / 특징 설명 / 리뷰 영역
  3. 캡처를 이 채팅에 일괄 첨부

캡처를 모두 첨부하면 `다음` 입력. 이미지를 분석해서 정리합니다.
```

사용자가 `다음`을 입력했고 첨부 이미지가 있으면 다음 프롬프트로 분석:

```
첨부한 경쟁사 상세페이지 캡처들을 분석해서
input/competitor_detail_pages.md 로 저장.

각 캡처는 한 상품 영역별일 수도, 다른 상품이 섞였을 수도 있음.
출처가 다르면 상품별로 구분해서 정리.

상품별 출력:
# {상품명}
> 출처 / 수집 시각
- 브랜드 / 가격 / 평점·리뷰수 / 배송
## 옵션 / 주요 특징 / 스펙 / 상세 설명

마지막에 비교 섹션:
## 경쟁사 비교 요약
- 공통으로 강조하는 것 3개
- 경쟁사별 차별화 포인트
- 우리가 비집고 들어갈 빈틈
```

성공: `input/competitor_detail_pages.md` 생성. Read로 1~30줄 + "경쟁사 비교 요약" 섹션 미리보기.
실패: 첨부 이미지 없음 → "캡처 이미지를 먼저 첨부해 주세요" 안내 후 대기.

---

### 2단계: 유튜브 웹서치
표시: "2/7 유튜브 비교 리뷰 검색 → input/youtube_review_links.md"

WebSearch 도구로 실행:

```
WebSearch로 "{product_category} 비교 리뷰" 검색해서
유튜브 비교/후기 영상 3~5개 추천.
제목 / URL / 핵심 요약(어떤 제품 비교, 평가 기준)을
input/youtube_review_links.md 로 저장.
```

성공: `input/youtube_review_links.md` 생성. 영상 3~5개 목록 미리보기.
의미: NotebookLM이 유튜브 URL에서 자막을 자동 추출하므로 링크만 넘기면 됨.

---

### 3단계: 클로드 자율 보강 ⭐ 발상 전환
표시: "3/7 부족한 영역 자율 검색 → input/extra_references.md"

사용자에게 안내: "키워드를 사람이 주지 않습니다. 부족한 자료를 클로드가 식별하고 직접 WebSearch로 보강합니다."

다음 프롬프트로 자율 실행:

```
{product_name}의 쿠팡 상세페이지를 만들 거야.
입력 자료를 먼저 점검해줘.

기존 자료:
- output/research_brief.md
- output/review_keywords_analysis.md
- output/target_personas.md
- output/market_analysis_report.md
- input/competitor_detail_pages.md
- input/youtube_review_links.md

요구:
1) 위 자료를 훑고, 부족한 영역을 카테고리별로 식별:
   ① 페인포인트 보강
   ② 인증·규제
   ③ 카피 레퍼런스
   ④ 시장 통계 보강
   ⑤ 디자인 레퍼런스

2) 부족한 카테고리에 한해 WebSearch 직접 호출,
   신뢰도 높은 자료 5~8개 수집.

3) 카테고리별로 묶어서
   input/extra_references.md 로 저장.
   각 항목에 URL, 한 줄 요약, 인용 문장 표시.

키워드는 네가 결정. 페인포인트와 페르소나를 고려해줘.
```

성공: `input/extra_references.md` 생성. 카테고리 5개 + 항목 5~8개 미리보기.
사용자에게 안내: "결과를 한 번 훑어 톤에 안 맞는 항목은 제외하세요. 자율 검색이지만 큐레이션은 사람의 몫입니다."

---

## B. NotebookLM 등록 (4) — 약 2분 (수동)

### 4단계: NotebookLM에 3종 소스 등록
이 단계는 **사용자가 NotebookLM 웹**(notebooklm.google.com)에서 직접 수행. 마법사는 명령을 실행하지 않고 안내만 제공.

사용자에게 다음을 그대로 출력:

```
NotebookLM에서 "{notebooklm_notebook}" 노트북을 열고 다음 3종을 등록하세요.

🔹 ① competitor_detail_pages.md
   · "+ 소스 추가" → "텍스트 복사" → 파일 본문 붙여넣기
   · 제목: "경쟁사 상세페이지 분석"

🔹 ② 유튜브 URL 3~5개 (input/youtube_review_links.md 참고)
   · "+ 소스 추가" → "웹사이트" → URL 하나씩 입력
   · NotebookLM이 자막을 자동 추출

🔹 ③ extra_references.md
   · "+ 소스 추가" → "텍스트 복사" → 파일 본문 붙여넣기
   · 제목: "자율 보강 자료"

⚠️ 인덱싱 30초~1분 대기 후 다음 단계 진행.

Part 4 누적 소스(시장 분석 / 경쟁사 스펙 / 업계 뉴스 / 매뉴얼) 위에
오늘 3종이 추가되어 답변 품질이 한 단계 올라갑니다.

등록이 끝나면 `다음` 입력.
```

---

## C. 분석 산출물 생성 (5~7) — 약 7분

### 5단계: Pain Point 심층 분석 + 교차 검증
표시: "5/7 NotebookLM Pain Point 심층 질문 + 3소스 교차 검증 → output/pain_point_analysis.md"

먼저 NotebookLM에 심층 질문 (`scripts/ask.mjs` 사용):

```
node scripts/ask.mjs \
  "모든 소스를 종합해서 {product_category} 소비자의 Pain Point를 심층 분석. 단순 키워드 말고 ① 발생 사용 상황 ② 가장 심각하게 느끼는 고객 유형 ③ 경쟁사 상세페이지의 대응까지 포함. 소스 근거 명시." \
  output/_tmp_pain_notebooklm.md
```

답변 수신 후 교차 검증:

```
방금 받은 NotebookLM 답변(output/_tmp_pain_notebooklm.md)을
output/review_keywords_analysis.md, output/market_analysis_report.md와
교차 비교.

분류 기준:
- 3소스 모두 언급 → "확정"
- 2소스 언급 → "유력"
- 1소스만 언급 → "후보"

각 Pain Point마다 발생 상황 / 핵심 타겟 유형 / 경쟁사 대응 / 인용 출처 정리.
output/pain_point_analysis.md 로 저장.

⚠️ 후보(1소스) 중에서도 핵심 타겟의 치명적 불만이 들어 있으면
   1건이라도 살려서 별도 표시.
```

성공: `output/pain_point_analysis.md` 생성. 확정/유력/후보 분류표 미리보기.

---

### 6단계: 공감 키워드 맵 (기업 언어 ↔ 고객 언어)
표시: "6/7 기업 언어 vs 고객 언어 1:1 매핑 → output/empathy_keyword_map.md"

다음 프롬프트로 실행:

```
input/{product_slug}_reviews.md, input/extra_references.md 에서
고객이 실제 쓴 표현을 추출.
output/pain_point_analysis.md 의 각 Pain Point에 대해
기업 언어 vs 고객 언어를 1:1 매핑.

형식: Pain Point | 기업 언어 | 고객 언어 | 인용 출처
예시:
배터리 수명 | 21V 4.0Ah 리튬이온 | 주말에 나무 10그루 잘라도 남아요 | 네이버 리뷰 #15

규칙:
- 스펙 표현은 그대로 두고, 옆에 고객 표현을 병기
- 고객 불만 표현은 우리 제품 장점 카피로 변환해서 별도 컬럼 추가
- 인용 출처는 파일명 + 식별자(리뷰 번호 / URL / 캡처 영역)

output/empathy_keyword_map.md 로 저장.
```

이어서 리서치 브리프와 비교:

```
output/research_brief.md 의 '강조할 키워드 5개'와
방금 만든 empathy_keyword_map.md 비교.
- 빠진 항목 보완
- 새로 발견된 키워드 추가
- 빠진 이유까지 짧게 메모
```

성공: `output/empathy_keyword_map.md` 생성. 매핑 표 5~10행 미리보기.

---

### 7단계: Creative Brief 종합 ⭐ 최종 산출물
표시: "7/7 5개 파일 종합 → output/creative_brief.md"

다음 프롬프트로 실행:

```
다음 파일 모두 읽고 종합해서 {product_name} 쿠팡 상세페이지용
Creative Brief 생성.

입력:
- output/pain_point_analysis.md
- output/empathy_keyword_map.md
- output/target_personas.md
- output/research_brief.md
- input/competitor_detail_pages.md

구조:
1. 프로젝트 개요
2. 타겟 고객
3. 핵심 메시지 (한줄 + 서브 3개)
4. Pain Point → 소구 포인트 매핑
5. 경쟁사 대비 차별화
6. 톤앤매너
7. 상세페이지 섹션 순서 + 근거
8. 필수 키워드 (SEO + 공감)

모든 항목에 데이터 근거 명시 (어느 파일 / 어느 항목에서 도출했는지).
output/creative_brief.md 로 저장.
```

성공: `output/creative_brief.md` 생성. Read로 1~80줄 미리보기 표시.

---

## D. 마무리

### 종료 메시지
다음 형식으로 출력:

```
✅ 상세페이지 기획 완료

📥 입력 자료 (오늘 추가)
  · input/competitor_detail_pages.md   (경쟁사 캡처 → MD)
  · input/youtube_review_links.md      (유튜브 비교 리뷰)
  · input/extra_references.md          (클로드 자율 보강)

📤 분석 산출물 (오늘 생성)
  · output/pain_point_analysis.md      (3소스 교차 검증)
  · output/empathy_keyword_map.md      (기업 언어 ↔ 고객 언어)
  · output/creative_brief.md           ★ 다음 클립 입력

핵심 메시지: 고객의 언어로 말해야 고객이 듣는다.
스펙은 기업만 알아듣고, 경험은 고객도 알아듣습니다.

다음 클립: 마케터 ↔ 디자이너 에이전트 토론 → 상세페이지 기획안

다시 처음부터 진행하려면 "상세페이지 기획하자"
```

마법사 종료.
