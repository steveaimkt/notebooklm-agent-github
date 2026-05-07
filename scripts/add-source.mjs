#!/usr/bin/env node
/**
 * NotebookLM 노트북에 웹 URL 소스 추가
 *
 * 사용법:
 *   node scripts/add-source.mjs "<notebook_id_or_url>" "<source_url>" ["<title>"]
 */
import { spawn } from 'child_process';

const target = process.argv[2];
const sourceUrl = process.argv[3];
const title = process.argv[4];

if (!target || !sourceUrl) {
  console.error('사용법: node scripts/add-source.mjs "<notebook_id_or_url>" "<source_url>" ["<title>"]');
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

server.stderr.on('data', (data) => { process.stderr.write(data); });

function send(method, params = {}, timeoutMs = 480000) {
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

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'add-source', version: '1.0.0' }
  });

  console.log(`📥 소스 추가 중`);
  console.log(`   노트북: ${target}`);
  console.log(`   URL: ${sourceUrl}`);
  if (title) console.log(`   제목: ${title}`);

  const args = {
    type: 'url',
    content: sourceUrl,
    show_browser: true,
    browser_options: { show: true, headless: false, timeout_ms: 120000 }
  };
  // notebook_id (UUID) 또는 notebook_url 둘 다 시도
  if (target.startsWith('http')) {
    args.notebook_url = target;
  } else {
    args.notebook_id = target;
  }
  if (title) args.title = title;

  const res = await send('tools/call', { name: 'add_source', arguments: args });
  const text = res.result?.content?.[0]?.text;
  console.log('\n=== 응답 ===');
  console.log(text || JSON.stringify(res.result, null, 2));

  server.stdin.end();
  setTimeout(() => process.exit(0), 1500);
})().catch(err => {
  console.error('소스 추가 실패:', err.message);
  process.exit(1);
});
