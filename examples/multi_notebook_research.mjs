/**
 * 멀티 노트북 리서치 예제
 *
 * 여러 NotebookLM 노트북을 등록하고, 순차적으로 질문하여
 * 통합 리서치 결과를 수집하는 예제입니다.
 *
 * 사용법:
 *   node examples/multi_notebook_research.mjs
 *
 * 실행 전에 아래의 NOTEBOOKS 배열에 실제 노트북 정보를 입력하세요.
 */
import { spawn } from 'child_process';

// ============================================
// 여기에 실제 노트북 정보를 입력하세요
// ============================================
const NOTEBOOKS = [
  {
    url: 'https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID_1',
    name: '시장분석',
    description: '시장 트렌드 및 규모 분석 자료',
    topics: ['시장 트렌드', '산업 분석']
  },
  {
    url: 'https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID_2',
    name: '경쟁사분석',
    description: '경쟁사 제품 리뷰 및 전략 분석',
    topics: ['경쟁사', '제품 리뷰']
  }
];

const QUESTIONS = [
  { notebook: '시장분석', question: '현재 시장의 주요 트렌드 3가지를 정리해줘' },
  { notebook: '경쟁사분석', question: '경쟁사 제품의 가장 많은 불만 사항 3가지는?' },
  { notebook: '시장분석', question: '향후 1년 내 가장 유망한 제품 카테고리는?' }
];
// ============================================

const server = spawn('npx', ['-y', 'notebooklm-mcp@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let msgId = 0;
let buffer = '';
const pending = new Map();

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

server.stderr.on('data', () => {});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, 120000);
    pending.set(id, (res) => { clearTimeout(timer); resolve(res); });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

async function main() {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'research-client', version: '1.0.0' }
  });

  // 1. 노트북 등록
  console.log('📚 노트북 등록 중...\n');
  for (const nb of NOTEBOOKS) {
    const res = await send('tools/call', {
      name: 'add_notebook',
      arguments: {
        url: nb.url,
        name: nb.name,
        description: nb.description,
        topics: nb.topics
      }
    });
    console.log(`  ✅ ${nb.name} 등록 완료`);
  }

  // 2. 순차 질문
  console.log('\n🔍 리서치 질문 시작...\n');
  const results = [];

  for (const q of QUESTIONS) {
    console.log(`  📖 [${q.notebook}] ${q.question}`);
    const nb = NOTEBOOKS.find(n => n.name === q.notebook);
    if (!nb) {
      console.log(`    ❌ 노트북 "${q.notebook}"을 찾을 수 없습니다.`);
      continue;
    }

    const res = await send('tools/call', {
      name: 'ask_question',
      arguments: { question: q.question, notebook_url: nb.url }
    });

    const content = res.result?.content?.[0]?.text;
    let answer = content;
    try {
      const parsed = JSON.parse(content);
      answer = parsed.answer || content;
    } catch {}

    results.push({ notebook: q.notebook, question: q.question, answer });
    console.log(`    ✅ 응답 수신 완료\n`);
  }

  // 3. 결과 요약 출력
  console.log('\n' + '='.repeat(60));
  console.log('📋 리서치 결과 요약');
  console.log('='.repeat(60) + '\n');

  for (const r of results) {
    console.log(`--- [${r.notebook}] ${r.question} ---`);
    console.log(r.answer);
    console.log();
  }

  server.stdin.end();
  setTimeout(() => process.exit(0), 3000);
}

main().catch(console.error);
