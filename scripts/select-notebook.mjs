#!/usr/bin/env node
/**
 * 기본 노트북 선택 스크립트
 *
 * 사용법:
 *   node scripts/select-notebook.mjs "<이름 또는 URL 또는 ID>"
 *
 * list_notebooks로 매칭되는 노트북을 찾아 select_notebook 호출.
 */
import { spawn } from 'child_process';

const query = process.argv[2];
if (!query) {
  console.error('사용법: node scripts/select-notebook.mjs "<이름 또는 URL 또는 ID>"');
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
      reject(new Error('타임아웃 (30초)'));
    }, 30000);
    pending.set(id, (res) => { clearTimeout(timer); resolve(res); });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function extractText(res) {
  return res.result?.content?.[0]?.text;
}

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'select-notebook', version: '1.0.0' }
  });

  const listRes = await send('tools/call', { name: 'list_notebooks', arguments: {} });
  const listText = extractText(listRes);
  let notebooks = [];
  try {
    const parsed = JSON.parse(listText);
    notebooks = parsed.notebooks || parsed.data || parsed;
    if (!Array.isArray(notebooks)) notebooks = [];
  } catch {
    console.error('노트북 목록 파싱 실패. 응답:', listText);
    process.exit(1);
  }

  if (notebooks.length === 0) {
    console.error('등록된 노트북이 없습니다. 먼저 setup-notebook.mjs로 등록하세요.');
    process.exit(1);
  }

  const q = query.toLowerCase();
  const matched = notebooks.find(n =>
    (n.id && n.id.toLowerCase() === q) ||
    (n.name && n.name.toLowerCase() === q) ||
    (n.url && n.url.toLowerCase() === q) ||
    (n.name && n.name.toLowerCase().includes(q)) ||
    (n.url && n.url.toLowerCase().includes(q))
  );

  if (!matched) {
    console.error(`매칭되는 노트북을 찾을 수 없습니다: "${query}"`);
    console.error('등록된 노트북:');
    for (const n of notebooks) console.error(`  - ${n.id} | ${n.name} | ${n.url}`);
    process.exit(1);
  }

  console.log(`🎯 선택: ${matched.name} (${matched.id})`);
  const res = await send('tools/call', {
    name: 'select_notebook',
    arguments: { id: matched.id }
  });
  console.log(extractText(res) || JSON.stringify(res.result, null, 2));

  server.stdin.end();
  setTimeout(() => process.exit(0), 1500);
})().catch(err => {
  console.error('선택 실패:', err.message);
  process.exit(1);
});
