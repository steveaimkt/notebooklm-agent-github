#!/usr/bin/env node
/**
 * NotebookLM 자동 리포트 .md → 깔끔한 HTML 변환
 *
 * 사용법:
 *   node scripts/build-html.mjs <입력.md> <출력.html>
 */
import { readFileSync, writeFileSync } from 'fs';

const inFile = process.argv[2];
const outFile = process.argv[3];
if (!inFile || !outFile) {
  console.error('사용법: node scripts/build-html.mjs <입력.md> <출력.html>');
  process.exit(1);
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const md = readFileSync(inFile, 'utf8');

// 1) 헤더 메타 추출
const titleMatch = md.match(/^# (.+)$/m);
const dateMatch = md.match(/_생성: (.+?)_/);
const title = titleMatch ? titleMatch[1] : 'Report';
const generated = dateMatch ? dateMatch[1] : '';

// 2) 섹션 단위로 분할 (## …)
const sections = [];
const re = /^## (.+?)$([\s\S]*?)(?=^## |^---\s*$|^# 출처|\Z)/gm;
let m;
while ((m = re.exec(md)) !== null) {
  const heading = m[1].trim();
  let body = m[2].trim();
  if (body) sections.push({ heading, body });
}

// 3) 본문 인라인 변환
//   - "[AI-GENERATED…]" 헤더 라인은 별도 노트로
//   - 줄에 숫자만 있는 경우 → 직전 텍스트 끝에 <sup class=cite>n</sup>
//   - "근거 소스 파일명:" / "출처 파일명:" → 콜아웃 박스
//   - "1순위 …" 같은 시작 패턴 → 우선순위 배지
function transformBody(body) {
  // AI-GENERATED 디스클레이머 분리
  let disclaimer = '';
  body = body.replace(/^\[AI-GENERATED[^\]]*\]\s*\n*/m, (mm) => {
    disclaimer = mm.trim();
    return '';
  });

  // 라인 단위 처리
  const lines = body.split('\n');
  const out = [];
  let buf = '';
  const flush = () => {
    if (buf.trim()) {
      // 콜아웃 라인
      const callout = buf.match(/^(근거 소스 파일명|출처 파일명|영향 정도|실행 목표 및 KPI|추진 근거|리스크 내용)\s*[:：]\s*(.+)$/);
      if (callout) {
        out.push(`<div class="callout"><span class="callout-label">${escapeHtml(callout[1])}</span><span class="callout-body">${escapeHtml(callout[2])}</span></div>`);
      } else {
        // 우선순위 배지: "1순위:" / "1. " 시작
        let html = escapeHtml(buf.trim());
        html = html.replace(/^(\d+)순위\s*[:：]?\s*/, (_, n) => `<span class="rank">${n}순위</span> `);
        html = html.replace(/^(\d+)\.\s+/, (_, n) => `<span class="num">${n}</span> `);
        // **굵게** → <strong>
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        out.push(`<p>${html}</p>`);
      }
    }
    buf = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') { flush(); continue; }
    // 숫자만 있는 라인 → 직전 출력에 superscript 추가
    if (/^\d+$/.test(line)) {
      if (out.length > 0) {
        // 마지막 <p>에 추가
        const last = out[out.length - 1];
        if (last.endsWith('</p>')) {
          out[out.length - 1] = last.replace(/<\/p>$/, ` <sup class="cite">${line}</sup></p>`);
        } else {
          out.push(`<sup class="cite">${line}</sup>`);
        }
      } else {
        // 버퍼에 누적된 텍스트 끝에 추가
        buf = buf.trimEnd() + ` <sup class="cite">${line}</sup>`;
      }
      continue;
    }
    // 점 라인(.) → 직전 paragraph 마침표
    if (line === '.') {
      if (out.length > 0 && out[out.length - 1].endsWith('</p>')) {
        out[out.length - 1] = out[out.length - 1].replace(/<\/p>$/, '.</p>');
      }
      continue;
    }
    if (buf) buf += ' ' + line;
    else buf = line;
  }
  flush();

  return { html: out.join('\n'), disclaimer };
}

const sectionHtml = sections.map((s, idx) => {
  const { html, disclaimer } = transformBody(s.body);
  return `
    <section class="card" id="s${idx + 1}">
      <h2><span class="hidx">${String(idx + 1).padStart(2, '0')}</span>${escapeHtml(s.heading)}</h2>
      ${disclaimer ? `<div class="disclaimer">${escapeHtml(disclaimer)}</div>` : ''}
      ${html}
    </section>`;
}).join('\n');

const tocHtml = sections.map((s, idx) =>
  `<a href="#s${idx + 1}" class="toc-item"><span class="toc-num">${String(idx + 1).padStart(2, '0')}</span>${escapeHtml(s.heading)}</a>`
).join('\n');

const sourcesList = [
  '크래프트볼트_시장조사_리포트.pdf <span class="src-tag">PDF</span>',
  '★ 최종 전기톱 사용설명서 시안.pdf <span class="src-tag">PDF</span>',
  '쿠팡 사용자 리뷰 (스크린샷 3종) <span class="src-tag">텍스트</span>',
  'Pro Tool Reviews — Best Mini Chainsaw <span class="src-tag">URL</span>',
  'GMI — Cordless Power Tools Market 2025-2034 <span class="src-tag">URL</span>',
  '가구네닷컴 — 2025 한국 홈 인테리어 트렌드 <span class="src-tag">URL</span>',
];

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --bg: #f6f7fb;
    --card: #ffffff;
    --ink: #1f2330;
    --ink-2: #525a73;
    --muted: #8a93ad;
    --accent: #4f46e5;
    --accent-2: #6366f1;
    --line: #eaecf3;
    --callout-bg: #f4f5fb;
    --callout-line: #4f46e5;
    --tag-bg: #eef0fa;
    --tag-ink: #4f46e5;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "SF Pro KR", "SF Pro Display", "Helvetica Neue", "Apple SD Gothic Neo", sans-serif;
    background: var(--bg);
    color: var(--ink);
    line-height: 1.7;
    font-size: 15.5px;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 56px 28px 96px; }

  header.hero {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: #fff;
    border-radius: 18px;
    padding: 36px 36px 30px;
    margin-bottom: 28px;
    box-shadow: 0 18px 40px -20px rgba(79, 70, 229, .55);
  }
  header.hero .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,.18);
    backdrop-filter: blur(8px);
    font-size: 12px;
    letter-spacing: .04em;
    font-weight: 600;
    margin-bottom: 12px;
  }
  header.hero h1 {
    margin: 0 0 10px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.3;
  }
  header.hero .meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 16px;
    font-size: 13px;
    opacity: .92;
  }
  header.hero .meta span { display: inline-flex; gap: 6px; align-items: center; }

  .toc {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 18px 22px;
    margin-bottom: 28px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 18px;
  }
  .toc-item {
    display: flex;
    gap: 10px;
    align-items: center;
    color: var(--ink);
    text-decoration: none;
    padding: 6px 0;
    font-size: 14px;
    font-weight: 500;
    transition: color .15s;
  }
  .toc-item:hover { color: var(--accent); }
  .toc-num {
    font-family: ui-monospace, SFMono-Regular, monospace;
    color: var(--muted);
    font-size: 12px;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 28px 32px;
    margin-bottom: 18px;
    box-shadow: 0 1px 2px rgba(15, 18, 30, .03);
  }
  .card h2 {
    margin: 0 0 18px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--ink);
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .hidx {
    font-family: ui-monospace, SFMono-Regular, monospace;
    color: var(--accent);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .05em;
  }
  .card p { margin: 0 0 12px; color: var(--ink); }
  .card p:last-child { margin-bottom: 0; }

  .rank {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    margin-right: 8px;
    vertical-align: middle;
  }
  .num {
    display: inline-block;
    width: 22px;
    height: 22px;
    line-height: 22px;
    text-align: center;
    border-radius: 6px;
    background: var(--tag-bg);
    color: var(--accent);
    font-weight: 700;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    margin-right: 6px;
    vertical-align: middle;
  }
  sup.cite {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--tag-bg);
    color: var(--accent);
    font-size: 10.5px;
    font-weight: 700;
    margin: 0 2px;
    vertical-align: super;
    line-height: 1.4;
  }
  strong { color: var(--ink); font-weight: 700; }

  .disclaimer {
    background: #fff8e6;
    border-left: 3px solid #f59e0b;
    color: #92611c;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12.5px;
    margin: 0 0 18px;
    line-height: 1.55;
  }

  .callout {
    background: var(--callout-bg);
    border-left: 3px solid var(--callout-line);
    border-radius: 6px;
    padding: 10px 14px;
    margin: 8px 0 14px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .callout-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: var(--accent);
    background: #fff;
    padding: 3px 10px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .callout-body {
    color: var(--ink-2);
    font-size: 14px;
    flex: 1;
    min-width: 0;
  }

  .sources {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 22px 28px;
    margin-top: 28px;
  }
  .sources h2 {
    margin: 0 0 14px;
    font-size: 16px;
    color: var(--ink);
  }
  .sources ol {
    margin: 0; padding: 0; list-style: none;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 16px;
  }
  .sources li {
    padding: 8px 12px;
    background: #fafbfd;
    border: 1px solid var(--line);
    border-radius: 8px;
    font-size: 13.5px;
    color: var(--ink-2);
  }
  .src-tag {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 7px;
    border-radius: 4px;
    background: var(--tag-bg);
    color: var(--tag-ink);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: .03em;
  }

  footer.foot {
    margin-top: 40px;
    text-align: center;
    color: var(--muted);
    font-size: 12px;
  }

  @media (max-width: 640px) {
    .wrap { padding: 28px 16px 60px; }
    header.hero { padding: 28px 24px; }
    .card { padding: 22px; }
    .toc { grid-template-columns: 1fr; }
    .sources ol { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="badge">NOTEBOOKLM × MCP RESEARCH</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <span>📅 생성 ${escapeHtml(generated)}</span>
        <span>📚 소스 8개 (PDF 2 + 텍스트 1 + URL 3 + 스크린샷 등 2)</span>
        <span>🤖 Gemini 2.5 via NotebookLM</span>
      </div>
    </header>

    <nav class="toc" aria-label="목차">
      ${tocHtml}
    </nav>

    ${sectionHtml}

    <section class="sources">
      <h2>📚 사용된 소스</h2>
      <ol>
        ${sourcesList.map((s) => `<li>${s}</li>`).join('\n        ')}
      </ol>
    </section>

    <footer class="foot">
      Generated by <code>scripts/auto-report.mjs</code> + <code>scripts/build-html.mjs</code> · NotebookLM MCP Agent
    </footer>
  </div>
</body>
</html>
`;

writeFileSync(outFile, html, 'utf8');
console.log(`💾 저장됨: ${outFile} (${(html.length / 1024).toFixed(1)}KB)`);
