#!/usr/bin/env node
/**
 * 자동 리포트 생성 스크립트 (멀티패스)
 *
 * MCP 서버를 1회만 띄우고 6개의 표준 질문을 순차 실행 →
 * 섹션별로 합쳐서 마크다운 리포트로 저장.
 *
 * 사용법:
 *   node scripts/auto-report.mjs "<주제>" <출력파일.md> [노트북_URL]
 *
 * 예:
 *   node scripts/auto-report.mjs "무선 전동공구 시장" output/market_report.md
 */
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const topic = process.argv[2];
const outFile = process.argv[3];
const notebookUrl = process.argv[4];

if (!topic || !outFile) {
  console.error('사용법: node scripts/auto-report.mjs "<주제>" <출력파일.md> [노트북_URL]');
  process.exit(1);
}

const SECTIONS = [
  {
    title: '1. 시장 개요',
    question: `${topic}의 전체 규모와 최근 3년 성장 추이를 소스 기반으로 정리해줘. 각 수치마다 출처 파일명을 명시해.`
  },
  {
    title: '2. 주요 트렌드 (Top 3)',
    question: `${topic}에서 가장 중요한 트렌드 3가지를 우선순위 순으로 정리해. 각 트렌드마다 근거가 되는 소스 파일명을 인용해.`
  },
  {
    title: '3. 경쟁 환경',
    question: `${topic}의 주요 경쟁사 3곳과 각각의 강점·약점을 소스 기반으로 비교해줘.`
  },
  {
    title: '4. 기회 요인',
    question: `${topic}에서 신규 진입 또는 확장이 유리한 기회 요인 3가지를 도출해. 데이터/시장 신호 근거 포함.`
  },
  {
    title: '5. 리스크',
    question: `${topic}에서 주의해야 할 리스크 3가지(시장/규제/기술)를 정리해. 각 리스크의 영향 정도를 함께 평가해.`
  },
  {
    title: '6. 액션 아이템 (다음 분기)',
    question: `위 분석을 종합해서 다음 분기에 실행해야 할 구체적 액션 아이템 3개를 우선순위 순으로 제안해.`
  }
];

const server = spawn('npx', ['-y', 'notebooklm-mcp@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let msgId = 0;
const pending = new Map();
let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const msg = JSON.parse(t);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

server.stderr.on('data', () => {});

function send(method, params = {}, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`타임아웃 (${timeoutMs}ms)`));
    }, timeoutMs);
    pending.set(id, (res) => { clearTimeout(timer); resolve(res); });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function extractAnswer(res) {
  const text = res.result?.content?.[0]?.text;
  if (!text) return '(응답 없음)';
  try {
    const parsed = JSON.parse(text);
    return parsed.answer || text;
  } catch {
    return text;
  }
}

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'auto-report', version: '1.0.0' }
  });

  console.log(`📑 자동 리포트 생성: "${topic}"`);
  console.log(`   출력: ${outFile}`);
  console.log(`   섹션: ${SECTIONS.length}개\n`);

  const sections = [];
  let sessionId = null;

  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    console.log(`[${i + 1}/${SECTIONS.length}] ${s.title} ...`);

    const args = { question: s.question };
    if (notebookUrl) args.notebook_url = notebookUrl;
    if (sessionId) args.session_id = sessionId;

    const res = await send('tools/call', { name: 'ask_question', arguments: args });
    const answer = extractAnswer(res);

    // 첫 응답에서 session_id 캡처 → 이후 같은 세션 재사용
    if (!sessionId) {
      const text = res.result?.content?.[0]?.text;
      try {
        const parsed = JSON.parse(text);
        if (parsed.session_id) sessionId = parsed.session_id;
      } catch {}
    }

    sections.push(`## ${s.title}\n\n${answer}\n`);
    console.log(`    ✅ 완료 (${answer.length}자)`);
  }

  const md = [
    `# ${topic} — 종합 리서치 리포트`,
    '',
    `_생성: ${new Date().toISOString()}_  `,
    `_노트북: ${notebookUrl || '(기본 노트북)'}_`,
    '',
    '---',
    '',
    ...sections,
    '---',
    '',
    '## 출처',
    '',
    '본 리포트는 NotebookLM에 등록된 소스를 기반으로 작성되었습니다. 각 섹션의 인용 파일명을 참조하세요.',
    ''
  ].join('\n');

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, md, 'utf8');
  console.log(`\n💾 저장됨: ${outFile}`);

  server.stdin.end();
  setTimeout(() => process.exit(0), 1500);
})().catch(err => {
  console.error('리포트 생성 실패:', err.message);
  process.exit(1);
});
