#!/usr/bin/env node
/**
 * 헬스체크 스크립트
 * - get_health: 서버/인증 상태
 * - list_notebooks: 등록된 노트북 목록
 */
import { spawn } from 'child_process';

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
      reject(new Error('타임아웃'));
    }, 30000);
    pending.set(id, (res) => { clearTimeout(timer); resolve(res); });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'health-check', version: '1.0.0' }
  });

  const health = await send('tools/call', { name: 'get_health', arguments: {} });
  const list = await send('tools/call', { name: 'list_notebooks', arguments: {} });

  console.log('=== Health ===');
  console.log(health.result?.content?.[0]?.text || JSON.stringify(health.result));
  console.log('\n=== Notebooks ===');
  console.log(list.result?.content?.[0]?.text || JSON.stringify(list.result));

  server.stdin.end();
  setTimeout(() => process.exit(0), 1000);
})().catch(err => {
  console.error('Health check 실패:', err.message);
  process.exit(1);
});
