#!/usr/bin/env node
/**
 * 노트북 등록 스크립트
 *
 * 사용법:
 *   node scripts/setup-notebook.mjs <NOTEBOOK_URL> [이름] [설명] [태그,쉼표,구분]
 */
import { spawn } from 'child_process';

const url = process.argv[2];
const name = process.argv[3] || 'My Notebook';
const description = process.argv[4] || 'NotebookLM에 등록된 첫 노트북';
const topics = (process.argv[5] || 'general').split(',').map(s => s.trim()).filter(Boolean);

if (!url || !/^https:\/\/notebooklm\.google\.com\/notebook\//.test(url)) {
  console.error('사용법: node scripts/setup-notebook.mjs <https://notebooklm.google.com/notebook/...> [이름] [설명] [태그]');
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
      reject(new Error('타임아웃 (60초)'));
    }, 60000);
    pending.set(id, (res) => { clearTimeout(timer); resolve(res); });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'setup-notebook', version: '1.0.0' }
  });

  console.log(`📓 노트북 등록 중: ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   태그: ${topics.join(', ')}\n`);

  const res = await send('tools/call', {
    name: 'add_notebook',
    arguments: { url, name, description, topics }
  });

  const text = res.result?.content?.[0]?.text;
  console.log(text || JSON.stringify(res.result, null, 2));

  server.stdin.end();
  setTimeout(() => process.exit(0), 1500);
})().catch(err => {
  console.error('등록 실패:', err.message);
  process.exit(1);
});
