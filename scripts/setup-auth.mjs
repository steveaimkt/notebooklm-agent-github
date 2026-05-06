#!/usr/bin/env node
/**
 * Google 계정 인증 스크립트
 * notebooklm-mcp 서버를 띄우고 setup_auth 도구로 브라우저를 열어
 * 사용자가 직접 로그인하면 쿠키가 Chrome 프로필에 저장됩니다.
 *
 * 타임아웃: 5분
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

server.stderr.on('data', (data) => {
  const text = data.toString();
  if (/auth|login|🔐|✅|browser|navigate|error/i.test(text)) {
    process.stderr.write(text);
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('인증 타임아웃 (5분)'));
    }, 300000);
    pending.set(id, (res) => { clearTimeout(timer); resolve(res); });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'setup-auth', version: '1.0.0' }
  });

  console.log('🔐 Google 인증 브라우저 띄우는 중...');
  console.log('   브라우저에서 NotebookLM에 접속할 Google 계정으로 로그인하세요.\n');

  const res = await send('tools/call', {
    name: 'setup_auth',
    arguments: {
      show_browser: true,
      browser_options: { show: true, headless: false, timeout_ms: 300000 }
    }
  });

  const text = res.result?.content?.[0]?.text;
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.success || parsed.ok || parsed.authenticated) {
        console.log('\n✅ 인증 완료');
      } else {
        console.log('\n결과:', text);
      }
    } catch {
      console.log('\n결과:', text);
    }
  } else {
    console.log('\n응답:', JSON.stringify(res.result, null, 2));
  }

  server.stdin.end();
  setTimeout(() => process.exit(0), 1500);
})().catch(err => {
  console.error('인증 실패:', err.message);
  process.exit(1);
});
