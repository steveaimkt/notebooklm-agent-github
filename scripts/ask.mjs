#!/usr/bin/env node
/**
 * NotebookLM 질문 + 답변을 파일로 저장 (시연용)
 *
 * 사용법:
 *   node scripts/ask.mjs "<질문>" [출력파일] [노트북_URL]
 *
 * - 출력파일을 지정하면 답변을 파일로 저장 + stdout에도 출력
 * - 노트북 URL을 생략하면 select_notebook으로 지정된 기본 노트북 사용
 */
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const question = process.argv[2];
const outFile = process.argv[3];
const notebookUrl = process.argv[4];

if (!question) {
  console.error('사용법: node scripts/ask.mjs "<질문>" [출력파일] [노트북_URL]');
  process.exit(1);
}

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

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('타임아웃 (8분)'));
    }, 480000);
    pending.set(id, (res) => { clearTimeout(timer); resolve(res); });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'ask', version: '1.0.0' }
  });

  console.log(`❓ ${question}\n⏳ NotebookLM 응답 대기...\n`);

  const args = {
    question,
    show_browser: true,
    browser_options: { show: true, headless: false, timeout_ms: 60000 }
  };
  if (notebookUrl) args.notebook_url = notebookUrl;

  const res = await send('tools/call', { name: 'ask_question', arguments: args });
  const text = res.result?.content?.[0]?.text;
  let answer = text;
  try {
    const parsed = JSON.parse(text);
    answer = parsed.answer || text;
  } catch {}

  console.log('=== 답변 ===');
  console.log(answer);

  if (outFile) {
    mkdirSync(dirname(outFile), { recursive: true });
    const md = `# NotebookLM 응답\n\n## 질문\n\n${question}\n\n## 답변\n\n${answer}\n\n---\n_생성: ${new Date().toISOString()}_\n`;
    writeFileSync(outFile, md, 'utf8');
    console.log(`\n💾 저장됨: ${outFile}`);
  }

  server.stdin.end();
  setTimeout(() => process.exit(0), 1500);
})().catch(err => {
  console.error('질문 실패:', err.message);
  process.exit(1);
});
